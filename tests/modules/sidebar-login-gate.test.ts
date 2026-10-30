import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { reasoningEffortOptionsForPreset } from "../../src/settings/reasoning";
import type { PrefsStore } from "../../src/settings/storage";

const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/modules/sidebar.ts"),
  "utf8",
);

function section(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `missing source marker: ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

function memoryPrefs(): PrefsStore {
  const values = new Map<string, string>();
  return {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    clear: (key) => values.delete(key),
  };
}

describe("selection-only login gate", () => {
  it("starts logged out and persists authentication independently of presets", async () => {
    const storage = (await import("../../src/settings/storage")) as Record<
      string,
      (...args: any[]) => any
    >;
    expect(storage.loadSidebarAuth).toBeTypeOf("function");
    expect(storage.saveSidebarAuth).toBeTypeOf("function");

    const prefs = memoryPrefs();
    expect(storage.loadSidebarAuth(prefs)).toBe(false);
    storage.saveSidebarAuth(prefs, true);
    expect(storage.loadSidebarAuth(prefs)).toBe(true);
    storage.saveSidebarAuth(prefs, false);
    expect(storage.loadSidebarAuth(prefs)).toBe(false);
  });

  it("can clear the selected preset without manufacturing a replacement", async () => {
    const storage = (await import("../../src/settings/storage")) as Record<
      string,
      (...args: any[]) => any
    >;
    expect(storage.clearSelectedPresetID).toBeTypeOf("function");

    const prefs = memoryPrefs();
    storage.saveSelectedPresetID(prefs, "sidebar-login");
    expect(storage.loadSelectedPresetID(prefs)).toBe("sidebar-login");
    storage.clearSelectedPresetID(prefs);
    expect(storage.loadSelectedPresetID(prefs)).toBeNull();
  });

  it("renders only the credential gate before authentication", () => {
    const panel = section(
      sidebarSource,
      "function renderPanel(",
      "function renderPanelRecovery(",
    );
    expect(panel).toContain("loadSidebarAuth(zoteroPrefs())");
    expect(panel).toContain("renderSelectionLoginGate(doc, mount, state)");
    expect(panel.indexOf("renderSelectionLoginGate")).toBeLessThan(
      panel.indexOf("renderMessages"),
    );
    const guardedBranch = panel.slice(
      panel.indexOf("renderSelectionLoginGate"),
      panel.indexOf("renderMessages"),
    );
    expect(guardedBranch).toContain("} else {");
    expect(guardedBranch).not.toContain("renderInput");
    expect(guardedBranch.indexOf("} else {")).toBeLessThan(
      guardedBranch.indexOf("renderToolbar"),
    );
    expect(panel).toMatch(
      /selectionOnlyMode[\s\S]*?![\s\S]*?loadSidebarAuth|!loadSidebarAuth[\s\S]*?selectionOnlyMode/,
    );
  });

  it("asks only for the URL and password-key before login", () => {
    const gate = section(
      sidebarSource,
      "function renderSelectionLoginGate(",
      "async function logoutSelectionSession(",
    );
    expect(gate).toContain('"zai-login-gate"');
    expect(gate).toContain('className = "zai-login-base-url"');
    expect(gate).toContain('className = "zai-login-api-key"');
    expect(gate).not.toContain("zai-login-model");
    expect(gate).not.toContain("Model ID");
    expect(gate).not.toContain("模型 ID");
    expect(gate).toContain('className = "zai-login-submit"');
    expect(gate).toMatch(/zai-login-api-key[\s\S]{0,500}?\.type = "password"/);
    expect(gate).toContain('uiText("登录", "Sign in")');
  });

  it("discovers models, prefers gpt-6.1-sol, then tests before saving", () => {
    const login = section(
      sidebarSource,
      "async function selectionLoginPreset(",
      "function logoutSelectionSession(",
    );
    expect(login).toContain("fetchOpenAIModels");
    expect(login).toContain("testPresetConnectivity");
    expect(login).toContain("savePresets");
    expect(login).toContain("saveSelectedPresetID");
    expect(login).toContain("saveSidebarAuth");
    expect(login).toContain("sanitizedTestError");
    expect(login).toMatch(/const\s+models\s*=\s*await\s+fetchOpenAIModels\(/);
    expect(sidebarSource).toContain('"gpt-6.1-sol"');
    expect(login).toMatch(/models\.includes\([\s\S]{0,120}?\)/);
    expect(login).toMatch(/:\s*models\[0\]/);
    expect(login).toMatch(/\bmodels\s*,/);
    expect(login.indexOf("await fetchOpenAIModels")).toBeLessThan(
      login.indexOf("await testPresetConnectivity"),
    );
    expect(login.indexOf("await testPresetConnectivity")).toBeLessThan(
      login.indexOf("savePresets"),
    );
    expect(login.slice(login.indexOf("await testPresetConnectivity"))).toMatch(
      /\bmodels\s*,/,
    );
    expect(login.indexOf("savePresets")).toBeLessThan(
      login.indexOf("saveSidebarAuth"),
    );
    expect(login).toMatch(/saveSidebarAuth\([^,]+, true\)/);
  });

  it("keeps model and reasoning selectors in the authenticated selection composer", () => {
    const input = section(
      sidebarSource,
      "function renderInput(",
      "function composerMessageContent(",
    );
    expect(input).toMatch(
      /selectionOnly[\s\S]*?renderSelectionComposerFooter\(doc, mount, state/,
    );

    const footer = section(
      sidebarSource,
      "function renderSelectionComposerFooter(",
      "function renderComposerFooter(",
    );
    expect(footer).toContain("renderModelSwitcher(doc, mount, state)");
    expect(footer).toContain("renderComposerReasoningSelect(");
    expect(footer).not.toContain("renderSendTargetSwitcher");
    expect(footer).not.toContain("renderPresetSwitcher");
    expect(footer).not.toContain("renderYoloToggle");
  });

  it("offers the requested reasoning levels for gpt-6.1-sol", () => {
    const values = reasoningEffortOptionsForPreset({
      id: "selection-login",
      label: "Codex",
      provider: "openai",
      apiKey: "secret",
      baseUrl: "https://relay.example/v1",
      model: "gpt-6.1-sol",
      models: ["gpt-6.1-sol"],
      maxTokens: 8192,
    }).map(([value]) => value);
    expect(values).toEqual(
      expect.arrayContaining(["low", "medium", "high", "xhigh", "max"]),
    );
  });

  it("logs out by clearing stored keys, selection, and authentication", () => {
    const logout = section(
      sidebarSource,
      "function logoutSelectionSession(",
      "function renderToolbar(",
    );
    expect(logout).toContain('apiKey: ""');
    expect(logout).toContain("savePresets");
    expect(logout).toContain("clearSelectedPresetID");
    expect(logout).toMatch(/saveSidebarAuth\([^,]+, false\)/);
    expect(logout).toContain("state.selectedId = null");
    expect(logout).toContain("renderPanel(mount, state)");
  });

  it("shows a logout control only after the selection session is authenticated", () => {
    expect(sidebarSource).toContain('className = "zai-login-logout"');
    expect(sidebarSource).toContain('uiText("退出登录", "Sign out")');
    expect(sidebarSource).toMatch(
      /loadSidebarAuth\(zoteroPrefs\(\)\)[\s\S]*?renderSelectionLogoutButton/,
    );
  });
});
