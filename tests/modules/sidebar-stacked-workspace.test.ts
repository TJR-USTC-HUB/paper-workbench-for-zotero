import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/modules/sidebar.ts"),
  "utf8",
);
const css = readFileSync(
  resolve(process.cwd(), "addon/content/sidebar.css"),
  "utf8",
);

function ruleBody(pattern: RegExp): string {
  const match = css.match(pattern);
  expect(match, `missing CSS rule: ${pattern}`).not.toBeNull();
  return match?.[1] ?? "";
}

function backgroundValue(body: string): string {
  const match = body.match(/(?:^|;)\s*background:\s*([^;]+);/s);
  expect(match, `missing background declaration in: ${body}`).not.toBeNull();
  return (match?.[1] ?? "").replace(/\s+/g, " ").trim();
}

describe("three-column reader workspace", () => {
  it("mounts paper, translation, then the stacked note/chat work column in document flow", () => {
    expect(source).toContain(
      'doc.getElementById(\n    "zotero-context-splitter",\n  )',
    );
    expect(source).toContain("candidateContextSplitter?.parentNode === parent");
    expect(source).toMatch(
      /insertBefore\(translationSplitter, contextSplitter\);\s*parent\.insertBefore\(translationColumn, contextSplitter\);\s*parent\.insertBefore\(splitter, contextSplitter\);\s*parent\.insertBefore\(column, contextSplitter\);/s,
    );
    expect(source).toContain(
      "column.append(link, katexLink, noteColumn, noteSplitter, mount)",
    );
    expect(source).toContain('noteSplitter.setAttribute("orient", "vertical")');
    expect(source).toMatch(
      /mountFullTranslationHost\([\s\S]*?sidebar\.translationSplitter,[\s\S]*?\);/,
    );
  });

  it("uses a vertical work column whose chat fills all remaining height", () => {
    expect(css).toMatch(
      /#zai-column\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).toMatch(
      /#zai-column\s*>\s*#zai-root\s*\{[^}]*flex:\s*1 1 0;[^}]*height:\s*auto;[^}]*min-height:\s*0;/s,
    );
    expect(css).toMatch(
      /#zai-note-column\s*\{[^}]*flex:\s*0 0 auto;[^}]*width:\s*100%;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).toMatch(
      /#zai-note-column-splitter\s*\{[^}]*height:\s*6px;[^}]*cursor:\s*ns-resize;/s,
    );
    expect(css).toMatch(
      /\.messages-empty\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
    expect(css).toMatch(
      /\.empty-signatures\s*\{[^}]*position:\s*relative;[^}]*margin:\s*auto;[^}]*transform:\s*none;/s,
    );
  });

  it("keeps selection translation in its own scrollable column with large Chinese text", () => {
    expect(css).toMatch(
      /#zai-translation-column\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).toMatch(
      /\.zai-translation-body\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s,
    );
    expect(css).toMatch(
      /\.zai-translation-result-text\s*\{[^}]*font-size:\s*22px;[^}]*line-height:\s*1\.65;/s,
    );
  });

  it("uses one neutral surface for translation and selection chat while keeping left/right bubbles", () => {
    const translation = ruleBody(
      /\.zai-translation-root,\s*\.zai-translation-panel\s*\{([^}]*)\}/s,
    );
    const selection = ruleBody(/\.zai-selection-only\s*\{([^}]*)\}/s);
    const conversation = ruleBody(
      /\.zai-selection-only \.messages,\s*\.zai-selection-only \.composer\s*\{([^}]*)\}/s,
    );
    const sharedSurface = backgroundValue(translation);

    expect(backgroundValue(selection)).toBe(sharedSurface);
    expect(backgroundValue(conversation)).toBe(sharedSurface);
    expect(css).toMatch(
      /\.zai-selection-only \.bubble-user\s*\{[^}]*margin-left:\s*auto;[^}]*border-radius:/s,
    );
    expect(css).toMatch(
      /\.zai-selection-only \.bubble-assistant\s*\{[^}]*margin-right:\s*auto;[^}]*border-radius:/s,
    );

    const selectionOnlyCSS = css.slice(css.indexOf(".zai-selection-only {"));
    expect(selectionOnlyCSS).not.toMatch(
      /#95ec69|#07c160|#06ad56|rgba\(7,\s*193,\s*96/i,
    );
  });

  it("hides the reader workspace in library mode and the native context pane in strict three-column mode", () => {
    expect(css).toContain(
      ":root.zai-reader-workspace-inactive #zai-translation-column",
    );
    expect(css).toMatch(
      /:root\.zai-reader-workspace-active #zotero-context-splitter,[\s\S]*?#zotero-context-pane\s*\{[^}]*display:\s*none !important;/,
    );
    expect(css).toMatch(
      /:root\.zai-reader-workspace-active #tabs-deck\s*\{[^}]*min-width:\s*280px !important;/,
    );
    expect(css).toMatch(
      /:root\.zai-reader-workspace-compact #zai-translation-column,[\s\S]*?#zai-translation-column-splitter\s*\{[^}]*display:\s*none !important;/,
    );
  });

  it("keeps all three splitter targets usable at the 800px three-column threshold", () => {
    expect(source).toContain("const DOCKED_AI_SPLITTER_WIDTH = 6");
    expect(source).toContain("const TRANSLATION_SPLITTER_WIDTH = 6");
    expect(source).toContain("const MIN_THREE_COLUMN_WINDOW_WIDTH = 800");
    expect(css).toMatch(/#zai-column\s*\{[^}]*min-width:\s*260px;/s);
    expect(css).toMatch(
      /#zai-translation-column\s*\{[^}]*min-width:\s*240px;/s,
    );
    expect(css).toMatch(
      /#zai-column-splitter\s*\{[^}]*min-width:\s*6px;[^}]*width:\s*6px;[^}]*cursor:\s*ew-resize;/s,
    );
    expect(css).toMatch(
      /#zai-translation-column-splitter\s*\{[^}]*width:\s*6px;[^}]*min-width:\s*6px;[^}]*cursor:\s*ew-resize;/s,
    );
    expect(css).toMatch(
      /#zai-note-column-splitter\s*\{[^}]*flex:\s*0 0 6px;[^}]*height:\s*6px;[^}]*cursor:\s*ns-resize;/s,
    );
  });

  it("wraps model and reasoning controls inside the minimum-width work column", () => {
    expect(css).toMatch(
      /\.zai-selection-only \.zai-selection-composer-footer,[\s\S]*?\.zai-selection-only \.zai-selection-chat-controls\s*\{[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;/s,
    );
    expect(css).toMatch(
      /\.zai-selection-only \.zai-selection-model-control,[\s\S]*?\.zai-selection-only \.zai-selection-reasoning-control\s*\{[^}]*flex:\s*1 1 120px;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s,
    );
    expect(css).toMatch(
      /\.zai-selection-only \.zai-selection-composer-footer \.model-switcher-trigger,[\s\S]*?\.zai-selection-only \.zai-selection-chat-controls \.composer-reasoning select\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis;/s,
    );
  });
});
