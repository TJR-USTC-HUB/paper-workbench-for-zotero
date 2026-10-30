import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const browserPathEnvironmentVariables = [
  "PAPER_WORKBENCH_BROWSER_PATH",
  "CHROME_PATH",
];

export function resolveBrowserExecutable() {
  for (const name of browserPathEnvironmentVariables) {
    const configured = process.env[name]?.trim();
    if (configured) return configured;
  }

  const candidates = browserCandidates();
  const detected = candidates.find((candidate) => existsSync(candidate));
  if (detected) return detected;

  throw new Error(
    "No Chromium-based browser was found. Set PAPER_WORKBENCH_BROWSER_PATH " +
      "to the browser executable before running this developer script.",
  );
}

export function resolveBrowserProfile() {
  const configured = process.env.PAPER_WORKBENCH_BROWSER_PROFILE?.trim();
  if (configured) return configured;

  if (process.platform === "darwin") {
    return path.join(
      homedir(),
      "Library",
      "Application Support",
      "Paper Workbench for Zotero",
      "browser-profile",
    );
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || homedir(),
      "Paper Workbench for Zotero",
      "browser-profile",
    );
  }

  return path.join(
    process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share"),
    "paper-workbench-for-zotero",
    "browser-profile",
  );
}

function browserCandidates() {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }

  if (process.platform === "win32") {
    return [
      windowsCandidate(
        process.env.PROGRAMFILES,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      windowsCandidate(
        process.env["PROGRAMFILES(X86)"],
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      windowsCandidate(
        process.env.LOCALAPPDATA,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      windowsCandidate(
        process.env.PROGRAMFILES,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
      windowsCandidate(
        process.env["PROGRAMFILES(X86)"],
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
    ].filter(Boolean);
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
  ];
}

function windowsCandidate(base, ...segments) {
  return base ? path.join(base, ...segments) : "";
}
