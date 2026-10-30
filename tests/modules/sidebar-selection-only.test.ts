import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/sidebar.ts"),
  "utf8",
);

function section(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `missing source marker: ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

const panel = section("function renderPanel(", "function renderPanelRecovery(");
const toolbar = section(
  "function renderToolbar(",
  "function renderConversationSwitcher(",
);
const selectionNoteClose = section(
  "function renderSelectionNoteCloseButton(",
  "function renderToolbar(",
);
const closeNoteWindow = section(
  "async function closeCurrentNoteWindow(",
  "function setNoteColumnVisible(",
);
const input = section(
  "function renderInput(",
  "function composerMessageContent(",
);
const bubbleRender = section(
  "function bubble(",
  "function renderUserPdfSelectionContext(",
);
const composerSend = section(
  "async function sendComposerMessage(",
  "async function cancelPendingWebPromptTask(",
);
const send = section(
  "async function sendMessage(",
  "async function processNextQueuedChatTask(",
);
const queue = section(
  "async function processNextQueuedChatTask(",
  "function firstQueuedChatTaskAcrossConversations(",
);
const stream = section(
  "async function streamAssistant(",
  "function selectionOnlySystemPrompt(",
);
const promptCache = section(
  "function buildPromptCacheKey(",
  "function toolManualWithConfiguredGuides(",
);
const retry = section(
  "async function regenerateLastResponse(",
  "function resetChatTaskForRetry(",
);
const selectionRefresh = section(
  "function updateSelectionIndicators(",
  "function isFocusInside(",
);

describe("selection-only sidebar", () => {
  it("renders only the note picker in the selection-only toolbar", () => {
    expect(toolbar).toMatch(
      /if \(state\.localUiSettings\.selectionOnlyMode\) \{[\s\S]*?bottomRow\.append\(renderNotePicker\(doc, mount, state\)\);[\s\S]*?return bar;/,
    );
    expect(panel).toContain("if (!state.localUiSettings.selectionOnlyMode)");
    expect(panel).toContain("renderContextCard(");
  });

  it("shows an independent close-note button when the inline note is open", () => {
    expect(toolbar).toMatch(
      /bottomRow\.append\(renderNotePicker\(doc, mount, state\)\);[\s\S]*?if \(sidebar && isNoteColumnVisible\(sidebar\)\) \{[\s\S]*?bottomRow\.append\(renderSelectionNoteCloseButton\(doc, mount, state\)\)/,
    );
    expect(selectionNoteClose).toContain(
      'buttonEl(doc, uiText("关闭笔记", "Close note"))',
    );
    expect(selectionNoteClose).toContain(
      'button.className = "zai-note-close-button"',
    );
    expect(selectionNoteClose).toMatch(
      /button\.addEventListener\("click"[\s\S]*?await closeCurrentNoteWindow\(mount\);[\s\S]*?renderPanel\(mount, state\);/,
    );
    expect(closeNoteWindow).toContain(
      "await saveVisibleNoteBeforeSwitch(sidebar)",
    );
    expect(closeNoteWindow).toContain("setNoteColumnVisible(sidebar, false)");
  });

  it("requires a live PDF selection and omits auxiliary composer controls", () => {
    expect(input).toContain(
      'const selectedText = selectionOnly ? getStoredSelectedText(state.itemID) : "";',
    );
    expect(input).toContain("(!selectionOnly || !!selectedText)");
    expect(input).toContain("(selectionOnly && !selectedText)");
    expect(input).toContain("const queueAllowed = selectionOnly ? false");
    expect(input).toContain("state.networkDiagramTarget || selectionOnly");
    expect(input).toContain("...(!selectionOnly ? [slashMenu] : [])");
    expect(input).toContain("if (!selectionOnly) {");
  });

  it("shows only the answer body without process, reasoning, usage, or write panels", () => {
    expect(bubbleRender).toContain(
      "const selectionOnly = state.localUiSettings.selectionOnlyMode",
    );
    expect(bubbleRender).toMatch(
      /message\.role === "assistant" && !selectionOnly[\s\S]*?renderAssistantProcess/,
    );
    expect(bubbleRender).toContain(
      'message.role === "assistant" && message.thinking && !selectionOnly',
    );
    expect(bubbleRender).toContain(
      'message.role === "assistant" && message.usage && !selectionOnly',
    );
    expect(bubbleRender).toMatch(
      /message\.annotationDraft &&\s*!selectionOnly/,
    );
    expect(bubbleRender).toMatch(
      /message\.webAnnotationBatch &&\s*!selectionOnly/,
    );
  });

  it("rebuilds the compact composer when selection presence changes", () => {
    expect(selectionRefresh).toContain(
      "state?.localUiSettings.selectionOnlyMode",
    );
    expect(selectionRefresh).toContain(
      "composer.replaceWith(renderInput(mount.ownerDocument!, mount, state))",
    );
  });

  it("forces composer sends through the strict selection-only API path", () => {
    expect(composerSend).toContain(
      "if (state.localUiSettings.selectionOnlyMode)",
    );
    expect(composerSend).toContain("selectionOnly: true");
    expect(composerSend).toContain("explainSelection: true");
    expect(composerSend.indexOf("sendMessage(")).toBeLessThan(
      composerSend.indexOf('chatSendMode === "web"'),
    );
  });

  it("drops attachments, references, nearby passages, history, and queuing", () => {
    expect(send).toMatch(/const images = options\.selectionOnly\s*\? \[\]/);
    expect(send).toMatch(
      /const paperReferences = options\.selectionOnly\s*\? \[\]/,
    );
    expect(send).toContain("? { selectedText: rawSelectedText, context: {} }");
    expect(send).toContain(
      'options.selectionOnly || chatSelectionQuote ? "none" : state.historyMode',
    );
    expect(send).toContain("const shouldQueue =\n    !options.selectionOnly");
    expect(send).toContain("!options.selectionOnly &&\n    !!selectedText");
  });

  it("cancels ordinary tasks left in the queue when selection-only mode is active", () => {
    expect(queue).toContain("state.localUiSettings.selectionOnlyMode &&");
    expect(queue).toContain("userMessage.context?.selectionOnly !== true");
    expect(queue).toContain("markMessageTaskCancelled(userMessage)");
    expect(queue).toContain("void persistPanelConversations(state)");
    expect(queue).toMatch(
      /markMessageTaskCancelled\(userMessage\);[\s\S]*?persistPanelConversations\(state\);[\s\S]*?continue;/,
    );
  });

  it("does not let retry replay an ordinary or web/full-text turn", () => {
    expect(retry).toMatch(
      /state\.localUiSettings\.selectionOnlyMode\s*&&\s*userMessage\.context\?\.selectionOnly !== true[\s\S]*?return;/,
    );
    expect(retry.indexOf("selectionOnly !== true")).toBeLessThan(
      retry.indexOf("webPromptProviderForUserMessage"),
    );
  });

  it("streams with no history, paper text, tools, web search, or MCP", () => {
    expect(stream).toContain(
      "options.isolatedHistory || selectionOnly ? [] : history",
    );
    expect(stream).toContain("selectionOnlySystemPrompt()");
    expect(stream).toContain("const pinnedFullText = selectionOnly");
    expect(stream).toContain(
      "const attachedPapers = selectionOnly\n      ? []",
    );
    expect(stream).toContain("if (!selectionOnly) {\n      toolSession");
    expect(stream).toContain("const toolsForTurn = toolSession?.tools ?? [];");
    expect(stream).toContain(
      "maxToolIterations: selectionOnly ? 0 : contextPolicy.maxToolIterations",
    );
    expect(stream).toContain(
      "toolSettings: selectionOnly\n          ? undefined",
    );
  });

  it("uses a global prompt-cache bucket and no item relay key", () => {
    expect(stream).toContain("selectionOnly ? null : state.itemID");
    expect(stream).toMatch(
      /const relayRoutingItemKey = selectionOnly\s*\? undefined\s*: resolveItemKeyForCache\(state\.itemID\)/,
    );
    expect(promptCache).toContain(': "global"');
  });
});
