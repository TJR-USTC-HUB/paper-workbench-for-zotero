import {
  getCachedTranslation,
  cacheKey,
  setCachedTranslation,
} from "../translate/cache";
import { pickPreset } from "../translate/reader-mode-utils";
import { loadTranslateSettings } from "../translate/settings";
import {
  cleanTranslationOutput,
  translateSentence,
} from "../translate/translator";
import {
  loadPresets,
  loadSidebarAuth,
  type PrefsStore,
} from "../settings/storage";
import { uiText } from "../utils/ui-locale";

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const TRANSLATION_DEBOUNCE_MS = 180;
const MAX_SELECTION_CHARS = 6000;
const SELECTION_TRANSLATION_MAX_OUTPUT_TOKENS = 1536;

/**
 * A persistent selection-translation surface.
 *
 * Unlike the legacy PDF overlay, this controller never positions UI over the
 * paper. Reader selection is supplied by sidebar.ts, then the translation is
 * rendered into its own Zotero column.
 */
export class SelectionTranslationPanel {
  private source = "";
  private scopeKey = "";
  private selectionIdentity = "";
  private sourceWasTruncated = false;
  private request = 0;
  private timer: number | undefined;
  private abort: AbortController | null = null;
  private destroyed = false;

  constructor(
    private readonly mount: HTMLElement,
    private readonly prefs: PrefsStore,
  ) {
    this.renderIdle();
  }

  setContext(scopeKey: string): void {
    if (this.destroyed || scopeKey === this.scopeKey) return;
    this.scopeKey = scopeKey;
    this.source = "";
    this.selectionIdentity = "";
    this.request += 1;
    this.abort?.abort();
    this.abort = null;
    const win = this.mount.ownerDocument?.defaultView;
    if (this.timer != null && win) win.clearTimeout(this.timer);
    this.timer = undefined;
    this.renderIdle();
  }

  setSelection(value: string, scopeKey = ""): void {
    if (this.destroyed) return;
    const normalized = normalizeSource(value);
    const source = normalized.slice(0, MAX_SELECTION_CHARS);
    const sourceWasTruncated = source.length < normalized.length;
    // Keep the complete normalized selection in the identity. Length plus a
    // suffix can collide for two different passages that happen to end with
    // the same words, which would incorrectly suppress the second request.
    const selectionIdentity = `${scopeKey}\u0000${normalized}`;
    if (!source || selectionIdentity === this.selectionIdentity) return;
    this.source = source;
    this.scopeKey = scopeKey;
    this.selectionIdentity = selectionIdentity;
    this.sourceWasTruncated = sourceWasTruncated;
    this.request += 1;
    this.abort?.abort();
    this.abort = null;
    if (this.timer != null) {
      this.mount.ownerDocument?.defaultView?.clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!loadSidebarAuth(this.prefs)) {
      this.renderLocked(source);
      return;
    }
    this.renderPending(source, sourceWasTruncated);
    const win = this.mount.ownerDocument?.defaultView;
    if (!win) return;
    const request = this.request;
    this.timer = win.setTimeout(() => {
      this.timer = undefined;
      void this.translate(source, request);
    }, TRANSLATION_DEBOUNCE_MS);
  }

  refreshAuthentication(): void {
    if (this.destroyed) return;
    this.request += 1;
    this.abort?.abort();
    this.abort = null;
    const win = this.mount.ownerDocument?.defaultView;
    if (this.timer != null && win) win.clearTimeout(this.timer);
    this.timer = undefined;

    if (!loadSidebarAuth(this.prefs)) {
      if (this.source) this.renderLocked(this.source);
      else this.renderIdle();
      return;
    }
    if (!this.source) {
      this.renderIdle();
      return;
    }
    const source = this.source;
    const scopeKey = this.scopeKey;
    const sourceWasTruncated = this.sourceWasTruncated;
    this.selectionIdentity = "";
    this.setSelection(source, scopeKey);
    this.sourceWasTruncated = sourceWasTruncated;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.request += 1;
    this.abort?.abort();
    this.abort = null;
    const win = this.mount.ownerDocument?.defaultView;
    if (this.timer != null && win) win.clearTimeout(this.timer);
    this.timer = undefined;
    this.mount.replaceChildren();
  }

  private async translate(source: string, request: number): Promise<void> {
    if (!this.isCurrent(source, request)) return;
    if (!loadSidebarAuth(this.prefs)) {
      this.renderLocked(source);
      return;
    }
    const settings = loadTranslateSettings(this.prefs);
    const preset = pickPreset(loadPresets(this.prefs), settings.presetId);
    // The conversation model is stored on the selected preset. Prefer it over
    // the legacy translation setting so changing the model beside the chat
    // takes effect for the next selection without requiring another sign-in.
    const model = preset?.model || settings.model || "";
    if (!preset || !preset.apiKey.trim() || !model) {
      this.renderError(
        source,
        uiText(
          "登录信息已失效，请在右侧重新登录模型服务。",
          "Your sign-in has expired. Sign in to the model service again on the right.",
        ),
      );
      return;
    }

    const key = cacheKey({
      sentence: source,
      target: "zh",
      endpoint: preset.baseUrl,
      model,
      thinking: settings.thinking,
      ctxLevel: "none",
      kind: "selection-column-v1",
    });
    const cached = await getCachedTranslation(key);
    if (!this.isCurrent(source, request)) return;
    if (cached?.text) {
      this.renderDone(source, cleanTranslationOutput(cached.text), model, true);
      return;
    }

    const abort = new AbortController();
    this.abort = abort;
    let output = "";
    try {
      for await (const chunk of translateSentence({
        sentence: source,
        preset,
        model,
        thinking: settings.thinking,
        maxOutputTokens: SELECTION_TRANSLATION_MAX_OUTPUT_TOKENS,
        signal: abort.signal,
      })) {
        if (!this.isCurrent(source, request) || abort.signal.aborted) return;
        if (chunk.type === "text" && chunk.text) {
          output += cleanTranslationOutput(chunk.text);
          this.renderStreaming(source, output, model);
        } else if (chunk.type === "error") {
          this.renderError(
            source,
            chunk.message || uiText("翻译失败。", "Translation failed."),
          );
          return;
        } else if (chunk.type === "done") {
          const finalText = cleanTranslationOutput(output);
          if (!finalText) {
            this.renderError(
              source,
              uiText(
                "模型没有返回译文。",
                "The model returned no translation.",
              ),
            );
            return;
          }
          if (this.isCurrent(source, request)) {
            this.renderDone(source, finalText, model, false);
          }
          void setCachedTranslation(key, {
            text: finalText,
            model,
            createdAt: Date.now(),
          }).catch(() => {
            // A cache write is an optimization. Never replace a successful
            // translation with an error merely because local persistence failed.
          });
        }
      }
    } catch (error) {
      if (!abort.signal.aborted && this.isCurrent(source, request)) {
        this.renderError(
          source,
          error instanceof Error ? error.message : String(error),
        );
      }
    } finally {
      if (this.abort === abort) this.abort = null;
    }
  }

  private isCurrent(source: string, request: number): boolean {
    return (
      !this.destroyed && this.source === source && this.request === request
    );
  }

  private renderIdle(): void {
    const doc = this.mount.ownerDocument!;
    const panel = element(doc, "section", "zai-translation-panel");
    panel.append(
      translationHeader(doc, uiText("划词翻译", "Selection translation")),
      element(
        doc,
        "div",
        "zai-translation-empty",
        loadSidebarAuth(this.prefs)
          ? uiText(
              "在左侧论文中划选英文，中文译文会自动显示在这里。",
              "Select English text in the paper. Its Chinese translation will appear here automatically.",
            )
          : uiText(
              "请先在右侧登录模型服务；登录后划词会自动翻译。",
              "Sign in to the model service on the right. Selections will translate automatically afterward.",
            ),
      ),
    );
    this.mount.replaceChildren(panel);
  }

  private renderLocked(source: string): void {
    this.render(
      source,
      uiText(
        "请先在右侧登录模型服务。",
        "Sign in to the model service on the right.",
      ),
      uiText("未登录", "Signed out"),
      "",
    );
  }

  private renderPending(source: string, truncated: boolean): void {
    this.render(
      source,
      uiText("正在准备翻译…", "Preparing translation…"),
      truncated
        ? uiText(
            "选区较长 · 翻译前 6000 字符",
            "Long selection · translating first 6,000 characters",
          )
        : uiText("等待中", "Pending"),
      "",
    );
  }

  private renderStreaming(
    source: string,
    translation: string,
    model: string,
  ): void {
    this.render(
      source,
      translation,
      uiText("翻译中…", "Translating…"),
      model,
      true,
    );
  }

  private renderDone(
    source: string,
    translation: string,
    model: string,
    cached: boolean,
  ): void {
    this.render(
      source,
      translation,
      this.sourceWasTruncated
        ? uiText(
            "已完成 · 选区过长，仅译前 6000 字符",
            "Done · first 6,000 characters",
          )
        : cached
          ? uiText("已完成 · 缓存", "Done · cached")
          : uiText("已完成", "Done"),
      model,
    );
  }

  private renderError(source: string, message: string): void {
    this.render(
      source,
      message,
      uiText("翻译失败", "Translation failed"),
      "",
      false,
      true,
    );
  }

  private render(
    source: string,
    translation: string,
    status: string,
    model: string,
    streaming = false,
    error = false,
  ): void {
    const doc = this.mount.ownerDocument!;
    const panel = element(doc, "section", "zai-translation-panel");
    const head = translationHeader(
      doc,
      uiText("划词翻译", "Selection translation"),
    );
    const meta = element(doc, "div", "zai-translation-meta");
    const statusNode = element(doc, "span", "zai-translation-status", status);
    if (streaming) statusNode.classList.add("is-streaming");
    if (error) statusNode.classList.add("is-error");
    meta.append(statusNode);
    if (model)
      meta.append(element(doc, "span", "zai-translation-model", model));

    const body = element(doc, "div", "zai-translation-body");
    const sourceBlock = element(doc, "section", "zai-translation-source");
    sourceBlock.append(
      element(doc, "h3", "zai-translation-label", uiText("原文", "Source")),
      element(doc, "div", "zai-translation-source-text", source),
    );
    const resultBlock = element(doc, "section", "zai-translation-result");
    resultBlock.append(
      element(doc, "h3", "zai-translation-label", uiText("中文", "Chinese")),
      element(doc, "div", "zai-translation-result-text", translation),
    );
    body.append(sourceBlock, resultBlock);
    panel.append(head, meta, body);
    this.mount.replaceChildren(panel);
  }
}

function translationHeader(doc: Document, title: string): HTMLElement {
  const head = element(doc, "header", "zai-translation-head");
  head.append(
    element(doc, "span", "zai-translation-head-icon", "译"),
    element(doc, "h2", "zai-translation-title", title),
  );
  return head;
}

function element(
  doc: Document,
  tag: string,
  className: string,
  text?: string,
): HTMLElement {
  const node = doc.createElementNS(XHTML_NS, tag) as HTMLElement;
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeSource(value: string): string {
  return String(value || "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}
