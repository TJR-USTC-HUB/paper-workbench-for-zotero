import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  autosaveNoteNow,
  scheduleAutosaveNote,
} from "../../src/modules/note-autosave";

const sidebarSource = readFileSync("src/modules/sidebar.ts", "utf8");

function sourceFunction(name: string, nextName: string): string {
  const start = sidebarSource.indexOf(`async function ${name}(`);
  const end = sidebarSource.indexOf(`\nfunction ${nextName}(`, start);
  if (start < 0 || end < 0) throw new Error(`Could not extract ${name}`);
  return ts.transpileModule(sidebarSource.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const switchNoteSource = sourceFunction(
  "switchNoteForItem",
  "findExistingNoteForItem",
);

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("note save barriers", () => {
  it("flushes a pending fallback-editor debounce immediately", async () => {
    vi.useFakeTimers();
    const note = {
      setNote: vi.fn(),
      saveTx: vi.fn(async () => undefined),
    };
    const sidebar: any = {};
    const editor = document.createElement("div");
    const status = document.createElement("span");
    const saveButton = document.createElement("button");
    editor.innerHTML = "<p>latest text</p>";
    editor.dataset.savedHTML = "<p>old text</p>";
    document.body.append(editor);

    scheduleAutosaveNote(
      sidebar,
      note as unknown as Zotero.Item,
      editor,
      status,
      saveButton,
    );
    expect(sidebar.noteAutosaveTimer).toBeDefined();

    await autosaveNoteNow(
      sidebar,
      note as unknown as Zotero.Item,
      editor,
      status,
      saveButton,
    );

    expect(sidebar.noteAutosaveTimer).toBeUndefined();
    expect(note.setNote).toHaveBeenCalledWith("<p>latest text</p>");
    expect(note.saveTx).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1800);
    expect(note.saveTx).toHaveBeenCalledOnce();
  });

  it("waits for the old note save and ignores a stale rapid switch", async () => {
    let finishSave!: () => void;
    const saveVisibleNoteBeforeSwitch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const cleanup = vi.fn();
    const renderNoteWindow = vi.fn();
    const renderEmptyNoteView = vi.fn();
    const updateOpenNoteButton = vi.fn();
    const noteMount = document.createElement("div");
    const mount = document.createElement("div");
    document.body.append(mount, noteMount);
    const sidebar: any = {
      mount,
      noteMount,
      noteEditorCleanup: cleanup,
    };
    const states = new Map([[mount, { itemID: 2 }]]);
    const noteForItem = vi.fn((itemID: number | null) =>
      itemID == null ? null : ({ id: itemID + 100 } as Zotero.Item),
    );
    const switchNoteForItem = new Function(
      "saveVisibleNoteBeforeSwitch",
      "states",
      "findExistingNoteForItem",
      "renderNoteWindow",
      "renderEmptyNoteView",
      "updateOpenNoteButton",
      `${switchNoteSource}; return switchNoteForItem;`,
    )(
      saveVisibleNoteBeforeSwitch,
      states,
      noteForItem,
      renderNoteWindow,
      renderEmptyNoteView,
      updateOpenNoteButton,
    ) as (sidebar: unknown, itemID: number | null) => Promise<void>;

    const pending = switchNoteForItem(sidebar, 2);
    expect(cleanup).not.toHaveBeenCalled();
    expect(renderNoteWindow).not.toHaveBeenCalled();

    // A newer reader selection wins while the old note transaction is active.
    states.set(mount, { itemID: 3 });
    finishSave();
    await pending;

    expect(cleanup).not.toHaveBeenCalled();
    expect(noteForItem).not.toHaveBeenCalled();
    expect(renderNoteWindow).not.toHaveBeenCalled();
    expect(renderEmptyNoteView).not.toHaveBeenCalled();
  });

  it("starts the teardown save before destroying the note editor", () => {
    const start = sidebarSource.indexOf(
      "export function unregisterSidebarForWindow",
    );
    const end = sidebarSource.indexOf(
      "\nexport function unregisterSidebar()",
      start,
    );
    const unregisterSource = sidebarSource.slice(start, end);
    expect(
      unregisterSource.indexOf("saveVisibleNoteBeforeSwitch(state)"),
    ).toBeGreaterThan(-1);
    expect(
      unregisterSource.indexOf("saveVisibleNoteBeforeSwitch(state)"),
    ).toBeLessThan(unregisterSource.indexOf("state.noteEditorCleanup?.()"));
  });
});
