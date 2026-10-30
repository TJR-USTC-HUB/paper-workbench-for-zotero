import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticated: true,
  presetModel: "gpt-test",
  settingsModel: "gpt-test",
  getCachedTranslation: vi.fn(async () => undefined),
  setCachedTranslation: vi.fn(async () => undefined),
  translateSentence: vi.fn(),
}));

vi.mock("../../src/translate/cache", () => ({
  cacheKey: vi.fn(() => "selection-key"),
  getCachedTranslation: mocks.getCachedTranslation,
  setCachedTranslation: mocks.setCachedTranslation,
}));

vi.mock("../../src/translate/reader-mode-utils", () => ({
  pickPreset: (presets: unknown[]) => presets[0] ?? null,
}));

vi.mock("../../src/translate/settings", () => ({
  loadTranslateSettings: () => ({
    presetId: "preset",
    model: mocks.settingsModel,
    thinking: "low",
  }),
}));

vi.mock("../../src/translate/translator", () => ({
  cleanTranslationOutput: (value: string) => value.trim(),
  translateSentence: mocks.translateSentence,
}));

vi.mock("../../src/settings/storage", () => ({
  loadSidebarAuth: () => mocks.authenticated,
  loadPresets: () => [
    {
      id: "preset",
      provider: "openai",
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: mocks.presetModel,
    },
  ],
}));

vi.mock("../../src/utils/ui-locale", () => ({
  uiText: (zh: string) => zh,
}));

import { SelectionTranslationPanel } from "../../src/modules/selection-translation-panel";

const prefs = { get: vi.fn(), set: vi.fn() } as any;

function immediateTranslation(text: string) {
  return (async function* () {
    yield { type: "text" as const, text };
    yield { type: "done" as const };
  })();
}

async function runDebounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(181);
  await Promise.resolve();
  await Promise.resolve();
}

describe("SelectionTranslationPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.authenticated = true;
    mocks.presetModel = "gpt-test";
    mocks.settingsModel = "gpt-test";
    mocks.getCachedTranslation.mockReset().mockResolvedValue(undefined);
    mocks.setCachedTranslation.mockReset().mockResolvedValue(undefined);
    mocks.translateSentence
      .mockReset()
      .mockImplementation(() => immediateTranslation("对应中文"));
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("deduplicates the same normalized text inside one reader scope", async () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    const panel = new SelectionTranslationPanel(mount, prefs);

    panel.setSelection("  Selected   sentence.  ", "paper-1:pdf-a");
    panel.setSelection("Selected sentence.", "paper-1:pdf-a");
    await runDebounce();

    expect(mocks.translateSentence).toHaveBeenCalledTimes(1);
    expect(mocks.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({
        sentence: "Selected sentence.",
        maxOutputTokens: 1536,
      }),
    );
    expect(
      mount.querySelector(".zai-translation-result-text")?.textContent,
    ).toBe("对应中文");
  });

  it("does not conflate equal-length selections that share the same suffix", async () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    const panel = new SelectionTranslationPanel(mount, prefs);
    const suffix = ` ${"shared ending ".repeat(6)}shared ending`;
    const first = `${"A".repeat(96)}${suffix}`;
    const second = `${"B".repeat(96)}${suffix}`;

    panel.setSelection(first, "paper-1:pdf-a");
    await runDebounce();
    panel.setSelection(second, "paper-1:pdf-a");
    await runDebounce();

    expect(first).toHaveLength(second.length);
    expect(first.slice(-64)).toBe(second.slice(-64));
    expect(mocks.translateSentence).toHaveBeenCalledTimes(2);
    expect(mocks.translateSentence).toHaveBeenLastCalledWith(
      expect.objectContaining({ sentence: second }),
    );
  });

  it("uses the current conversation preset model instead of a stale translation model", async () => {
    mocks.presetModel = "gpt-current";
    mocks.settingsModel = "gpt-old";
    const mount = document.createElement("div");
    document.body.append(mount);
    const panel = new SelectionTranslationPanel(mount, prefs);

    panel.setSelection("Explain this selection.", "paper-1:pdf-a");
    await runDebounce();

    expect(mocks.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-current" }),
    );
    expect(mount.textContent).toContain("gpt-current");
    expect(mount.textContent).not.toContain("gpt-old");
  });

  it("aborts the old reader request and never lets its late result overwrite the new paper", async () => {
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    let oldSignal: AbortSignal | undefined;
    mocks.translateSentence.mockImplementation((request: any) => {
      if (request.sentence === "Old selection") {
        oldSignal = request.signal;
        return (async function* () {
          await oldGate;
          yield { type: "text" as const, text: "旧论文译文" };
          yield { type: "done" as const };
        })();
      }
      return immediateTranslation("新论文译文");
    });

    const mount = document.createElement("div");
    document.body.append(mount);
    const panel = new SelectionTranslationPanel(mount, prefs);
    panel.setSelection("Old selection", "paper-1:pdf-a");
    await runDebounce();
    expect(oldSignal?.aborted).toBe(false);

    panel.setContext("paper-2:pdf-b");
    expect(oldSignal?.aborted).toBe(true);
    panel.setSelection("New selection", "paper-2:pdf-b");
    await runDebounce();
    expect(mount.textContent).toContain("新论文译文");

    releaseOld();
    await Promise.resolve();
    await Promise.resolve();

    expect(mount.textContent).toContain("新论文译文");
    expect(mount.textContent).not.toContain("旧论文译文");
    expect(mocks.translateSentence).toHaveBeenCalledTimes(2);
  });

  it("keeps a successful translation visible when cache persistence fails", async () => {
    mocks.setCachedTranslation.mockRejectedValueOnce(new Error("disk full"));
    const mount = document.createElement("div");
    document.body.append(mount);
    const panel = new SelectionTranslationPanel(mount, prefs);

    panel.setSelection("A successful selection.", "paper-1:pdf-a");
    await runDebounce();
    await Promise.resolve();

    expect(
      mount.querySelector(".zai-translation-result-text")?.textContent,
    ).toBe("对应中文");
    expect(mount.textContent).not.toContain("disk full");
  });

  it("does not send a translation request while signed out", async () => {
    mocks.authenticated = false;
    const mount = document.createElement("div");
    document.body.append(mount);
    const panel = new SelectionTranslationPanel(mount, prefs);

    panel.setSelection("Private selection.", "paper-1:pdf-a");
    await runDebounce();

    expect(mocks.translateSentence).not.toHaveBeenCalled();
    expect(mount.textContent).toContain("请先在右侧登录模型服务");
  });
});
