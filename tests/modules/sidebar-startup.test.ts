import { readFileSync } from "node:fs";
import ts from "typescript";
import { Window } from "happy-dom";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("src/modules/sidebar.ts", "utf8");
const registration = source.slice(
  source.indexOf("export function registerSidebarForWindow("),
  source.indexOf("\nfunction scheduleWindowRegisterRetry("),
);
const js = ts.transpileModule(registration, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;

function setup(mode: "embedded" | "docked", aiOpen = false) {
  const doc = new Window({ settings: { disableCSSFileLoading: true } })
    .document;
  const pane = doc.createElement("div");
  pane.id = "zotero-context-pane";
  doc.body.append(pane);
  (doc as any).createXULElement = (tag: string) => doc.createElement(tag);
  const win = { document: doc };
  const sidebars = new WeakMap();
  const states = new WeakMap();
  const reconcile = vi.fn((_win, sidebar) => {
    if (mode === "docked") sidebar.column.removeAttribute("collapsed");
  });
  const dependencies = {
    exports: {},
    registered: true,
    windowSidebars: sidebars,
    windowRegisterRetries: new WeakMap(),
    mountedWindows: new Set(),
    states,
    XHTML_NS: "http://www.w3.org/1999/xhtml",
    SPLITTER_ID: "zai-column-splitter",
    COLUMN_ID: "zai-column",
    NOTE_SPLITTER_ID: "zai-note-column-splitter",
    NOTE_COLUMN_ID: "zai-note-column",
    TRANSLATION_SPLITTER_ID: "zai-translation-column-splitter",
    TRANSLATION_COLUMN_ID: "zai-translation-column",
    TRANSLATION_ROOT_ID: "zai-translation-root",
    ROOT_ID: "zai-root",
    NOTE_ROOT_ID: "zai-note-root",
    DEFAULT_AI_COLUMN_WIDTH: 380,
    DEFAULT_NOTE_COLUMN_WIDTH: 560,
    DEFAULT_NOTE_PANEL_HEIGHT: 360,
    DEFAULT_TRANSLATION_COLUMN_WIDTH: 380,
    MIN_AI_COLUMN_WIDTH: 260,
    MIN_NOTE_COLUMN_WIDTH: 260,
    MIN_NOTE_PANEL_HEIGHT: 180,
    MIN_TRANSLATION_COLUMN_WIDTH: 240,
    MAX_AI_COLUMN_WIDTH: 760,
    MAX_NOTE_COLUMN_WIDTH: 700,
    MAX_TRANSLATION_COLUMN_WIDTH: 620,
    SelectionTranslationPanel: class {
      constructor() {}
    },
    selectionTranslationPanels: new WeakMap(),
    zoteroPrefs: () => ({}),
    addon: { data: { config: { addonRef: "zotero-ai-sidebar" } } },
    loadReaderLayoutPrefs: () => ({
      aiWidth: 420,
      aiOpen,
      noteHeight: 360,
      translationWidth: 380,
    }),
    renderWindowSidebar: () => {
      states.set(sidebars.get(win).mount, {
        localUiSettings: { sidebarDisplayMode: mode },
      });
    },
    reconcileSidebarDisplayMode: reconcile,
    isColumnCollapsed: (sidebar: any) =>
      sidebar.column.getAttribute("collapsed") === "true",
    ...Object.fromEntries(
      [
        "scheduleWindowRegisterRetry",
        "updateToggleButton",
        "syncFullTranslationHostLayout",
        "installReaderLayoutMemory",
        "installToggleButton",
        "installFloatingToggle",
        "patchItemSelection",
        "startSelectionMonitor",
        "installSidebarCopyHandler",
        "installSidebarSelectionMenu",
        "installReaderPromptShortcutHandler",
        "scheduleInitialSidebarRefresh",
        "syncReaderWorkspaceVisibility",
      ].map((name) => [name, vi.fn()]),
    ),
  };
  const register = new Function(
    ...Object.keys(dependencies),
    `${js}; return registerSidebarForWindow;`,
  )(...Object.values(dependencies));
  register(win);
  return { sidebar: sidebars.get(win), register, win, doc, reconcile, states };
}

describe("sidebar startup", () => {
  it("round-trips the open state without losing saved widths", () => {
    let raw = JSON.stringify({ aiWidth: 420 });
    const prefsSource = source.slice(
      source.indexOf("function loadReaderLayoutPrefs("),
      source.indexOf("\nfunction syncReaderTranslateButtons("),
    );
    const prefsJs = ts.transpileModule(prefsSource, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const { load, save } = new Function(
      "Zotero",
      "READER_LAYOUT_PREF_KEY",
      "MIN_AI_COLUMN_WIDTH",
      "MAX_AI_COLUMN_WIDTH",
      "MIN_NOTE_COLUMN_WIDTH",
      "MAX_NOTE_COLUMN_WIDTH",
      "MIN_TRANSLATION_COLUMN_WIDTH",
      "MAX_TRANSLATION_COLUMN_WIDTH",
      `${prefsJs}; return { load: loadReaderLayoutPrefs, save: saveReaderLayoutPrefs };`,
    )(
      {
        Prefs: {
          get: () => raw,
          set: (_key: string, value: string) => {
            raw = value;
          },
        },
      },
      "readerLayout",
      260,
      760,
      260,
      700,
      240,
      620,
    );
    for (const aiOpen of [true, false]) {
      save({ aiOpen });
      expect(load()).toMatchObject({ aiOpen, aiWidth: 420 });
    }
    save({
      aiWidth: 100,
      dockedAiWidth: 120,
      translationWidth: 140,
      noteHeight: 80,
    });
    expect(load()).toMatchObject({
      aiWidth: 260,
      dockedAiWidth: 260,
      translationWidth: 240,
      noteHeight: 180,
    });
  });

  it.each([true, false])(
    "saves open=%s on window close and before teardown",
    (aiOpen) => {
      const win = new Window({ settings: { disableCSSFileLoading: true } });
      const sidebar = {
        column: win.document.createElement("div"),
        splitter: win.document.createElement("div"),
        noteColumn: win.document.createElement("div"),
        noteSplitter: win.document.createElement("div"),
        translationColumn: win.document.createElement("div"),
        translationSplitter: win.document.createElement("div"),
        layoutCleanup: undefined as undefined | (() => void),
      };
      const save = vi.fn();
      const memorySource = source.slice(
        source.indexOf("function installReaderLayoutMemory("),
        source.indexOf("\nfunction isNoteColumnVisible("),
      );
      const memoryJs = ts.transpileModule(memorySource, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText;
      new Function(
        "saveReaderLayoutPrefs",
        "isColumnCollapsed",
        "rememberLastAiWidth",
        "rememberLastNoteHeight",
        "rememberLastTranslationWidth",
        "syncFullTranslationHostLayout",
        "syncReadingTightLayout",
        "captureSplitterMouse",
        "setAiColumnWidth",
        "MAX_AI_COLUMN_WIDTH",
        "dockedSidebarLayouts",
        "states",
        `${memoryJs}; return installReaderLayoutMemory;`,
      )(
        save,
        () => !aiOpen,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        760,
        new WeakMap(),
        new WeakMap(),
      )(win, sidebar);
      win.dispatchEvent(new win.Event("beforeunload"));
      expect(save).toHaveBeenLastCalledWith({ aiOpen });
      save.mockClear();
      sidebar.layoutCleanup?.();
      expect(save).toHaveBeenLastCalledWith({ aiOpen });
      save.mockClear();
      win.dispatchEvent(new win.Event("beforeunload"));
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each(["embedded", "docked"] as const)(
    "restores an open sidebar with %s layout selected",
    (mode) => {
      const { sidebar, reconcile } = setup(mode, true);
      expect(sidebar.column.hasAttribute("collapsed")).toBe(false);
      expect(sidebar.splitter.hasAttribute("hidden")).toBe(false);
      expect(reconcile).toHaveBeenCalledOnce();
    },
  );
  it.each(["embedded", "docked"] as const)(
    "starts collapsed with %s layout selected",
    (mode) => {
      const { sidebar, reconcile } = setup(mode);
      expect(sidebar.column.getAttribute("collapsed")).toBe("true");
      expect(sidebar.splitter.getAttribute("hidden")).toBe("true");
      expect(sidebar.column.getAttribute("width")).toBe("420");
      expect(reconcile).not.toHaveBeenCalled();
    },
  );

  it("does not reset an opened sidebar when registration repeats", () => {
    const { sidebar, register, win, doc } = setup("embedded");
    sidebar.column.removeAttribute("collapsed");
    register(win);
    expect(sidebar.column.hasAttribute("collapsed")).toBe(false);
    expect(doc.querySelectorAll("#zai-column")).toHaveLength(1);
  });

  it.each(["embedded", "docked"] as const)(
    "opens on demand using the saved %s layout",
    (mode) => {
      const { sidebar, win, states } = setup(mode);
      const toggleSource = source.slice(
        source.indexOf("function setColumnCollapsed("),
        source.indexOf("\nfunction hideCurrentSidebar("),
      );
      const toggleJs = ts.transpileModule(toggleSource, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const enterDocked = vi.fn();
      const resize = vi.fn();
      (win as any).resizeBy = resize;
      const toggle = new Function(
        "states",
        "enterDockedSidebarLayout",
        "leaveDockedSidebarLayout",
        "updateToggleButton",
        "renderWindowSidebar",
        "closeSidebarNoteColumn",
        "isColumnCollapsed",
        "loadReaderLayoutPrefs",
        "DOCKED_AI_SPLITTER_WIDTH",
        "TRANSLATION_SPLITTER_WIDTH",
        "DEFAULT_TRANSLATION_COLUMN_WIDTH",
        "preserveMessagesScrollOnToggle",
        "syncReadingTightLayout",
        "syncReaderWorkspaceVisibility",
        `${toggleJs}; return setColumnCollapsed;`,
      )(
        states,
        enterDocked,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        () => sidebar.column.hasAttribute("collapsed"),
        () => ({ dockedAiWidth: 480, translationWidth: 380 }),
        6,
        6,
        380,
        (_mount: unknown, _collapsed: boolean, mutate: () => void) => mutate(),
        vi.fn(),
        vi.fn(),
      );
      toggle(win, sidebar, false);
      if (mode === "docked") {
        expect(enterDocked).toHaveBeenCalledWith(win, sidebar);
        expect(resize).toHaveBeenCalledWith(872, 0);
      } else {
        expect(sidebar.column.hasAttribute("collapsed")).toBe(false);
        expect(sidebar.splitter.hasAttribute("hidden")).toBe(false);
        expect(enterDocked).not.toHaveBeenCalled();
      }
    },
  );
});
