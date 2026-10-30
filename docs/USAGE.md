# Paper Workbench for Zotero — User Guide

English | [中文](USAGE.zh-CN.md)

Paper Workbench for Zotero is an unofficial community add-on. It turns the
Zotero PDF reader into a focused, resizable workspace:

```text
PDF paper | Selection translation | Notes + AI chat
```

It is not affiliated with or endorsed by Zotero or OpenAI.

## 1. Install

The same XPI works on Windows, macOS, and Linux.

1. Download `paper-workbench-for-zotero.xpi` from the
   [latest release](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/releases/latest).
2. In Zotero, open **Tools → Plugins**.
3. Open the gear menu and choose **Install Plugin From File…**.
4. Select the XPI and restart Zotero if prompted.
5. Open a PDF attachment.

The add-on supports Zotero 7–10. Node.js is needed only for development, not
for normal use.

## 2. Sign in to a model endpoint

The add-on starts signed out. The sign-in view asks for only two values:

- **Base URL** — the `/v1` address of an OpenAI-compatible service.
- **API Key** — the credential issued by that service.

There is deliberately no model-ID field on this screen. When you select
**Sign in**, the add-on:

1. requests `GET /models` from the configured endpoint;
2. chooses `gpt-6.1-sol` when it is available, otherwise the first returned
   model;
3. verifies that the selected model can respond; and
4. stores the endpoint, key, model list, and authenticated state in the current
   local Zotero profile.

After sign-in, choose a model and a supported reasoning level above the
composer. Depending on the model, levels may include `low`, `medium`, `high`,
`xhigh`, and `max`.

Select **Sign out** to cancel active requests, remove the saved API key and
current model selection, and return the AI and translation columns to their
signed-out state.

## 3. Use the three-column workspace

### Resize the columns

- Drag the boundary between the PDF and translation columns.
- Drag the boundary between the translation and work columns.
- When a note is open, drag the horizontal boundary between the note and chat.

The add-on remembers these sizes for the next session. The columns have minimum
widths so their contents do not overlap.

### Translate a PDF selection

1. Select an English sentence or paragraph in the open PDF.
2. The middle column displays the selected source and a large Chinese
   translation automatically.
3. Select another passage to replace the source and translation.

Translation uses the same signed-in endpoint. Nothing is sent while signed
out. The translation column shows explicit idle, loading, signed-out, and error
states.

### Ask about the selected passage

1. Select the exact PDF passage you want to discuss.
2. Optionally choose a model and reasoning level.
3. Type a question, or send the default request to explain the selection.
4. Press Enter to send; use Shift+Enter for a new line.

The focused chat request contains only the live PDF selection and the current
question. It does not attach the whole paper, surrounding passages, previous
turns, web search, tools, or other Zotero items. Earlier messages remain visible
in the local conversation but are not replayed in the next focused request.

The send button is disabled when there is no live selection or while signed
out.

### Work with notes

1. Select **Note** in the right-column toolbar.
2. Choose an existing child note or **New note**.
3. Edit the note in the upper part of the work column.
4. Drag the note/chat divider if you need more room.
5. Select **Close note** when finished.

The add-on saves the current note before switching notes or closing the note
surface. When the note closes, chat expands to fill the entire work column.
Opening, switching, or closing a note does not erase the conversation or the
composer draft.

## 4. Interface behavior

- User messages are aligned right; assistant replies are aligned left.
- Translation and chat use the same warm neutral palette.
- The focused interface intentionally hides legacy full-paper, queue, web-agent,
  tool, material, and debug controls.
- The current model and reasoning strength are chosen in the conversation view,
  after authentication.

## 5. Data and privacy

- The API key is stored in the current local Zotero profile.
- Translation sends the selected text to the endpoint you configured.
- Focused chat sends the selected text and current question to that endpoint.
- Zotero notes and library data remain managed by Zotero.
- No API key is embedded in the source, XPI, or release archive.

Local Zotero profiles and exported configuration backups may contain
credentials. Do not publish them. Review the privacy and retention policy of
your endpoint provider before use.

## 6. Troubleshooting

### Sign-in fails

- Confirm that the Base URL includes the service's API prefix, commonly `/v1`.
- Confirm that the key can call `GET /models` and a compatible Responses or Chat
  Completions endpoint.
- Check proxy, VPN, firewall, and certificate settings.
- If `/models` is unavailable, this focused sign-in flow cannot discover a
  model automatically.

### No translation appears

- Make sure you are signed in.
- Select actual PDF text rather than an image-only scanned region.
- Try a shorter selection and check whether the endpoint is responding.

### The send button is disabled

- Keep a live text selection in the current PDF.
- Verify that sign-in succeeded and a model is selected.
- Wait for any active response to finish.

### A note did not appear

- Open **Note** and choose the intended child note again.
- Ensure the current Zotero item is editable.
- Close the note surface normally so the final save can complete.

## 7. Update or uninstall

To update, install the newer XPI over the existing version and restart Zotero
if prompted.

To uninstall, open **Tools → Plugins**, open the add-on menu, choose **Remove**,
and restart Zotero if prompted. Sign out first if you want the add-on to clear
its saved API key. Removing the add-on does not delete Zotero notes or library
items.

## 8. Support and license

- [Report a bug or request a feature](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/issues)
- [Project README](../README.md)
- [Upstream attribution](../NOTICE.md)

The project is derived from
[xuhan-rgb/zotero-ai-sidebar](https://github.com/xuhan-rgb/zotero-ai-sidebar)
and is distributed under AGPL-3.0-or-later.
