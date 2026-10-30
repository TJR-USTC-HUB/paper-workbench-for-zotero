# Paper Workbench for Zotero

[中文](README.zh-CN.md)

An unofficial, cross-platform Zotero add-on for focused paper reading: a
three-column PDF workspace with automatic selection translation, notes, and
OpenAI-compatible AI chat.

> [!IMPORTANT]
> This is an unofficial community project. It is not affiliated with or
> endorsed by Zotero, OpenAI, or their respective maintainers.

[Download the latest XPI](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/releases/latest) ·
[Report an issue](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/issues)

## What it does

The reader is organized into three non-overlapping columns:

```text
PDF paper | Selection translation | Notes + AI chat
```

- **Resizable workspace** — drag the two vertical boundaries and the
  note/chat boundary. Sizes are remembered between sessions.
- **Automatic selection translation** — select text in the PDF and the middle
  column displays a large Chinese translation automatically.
- **Focused notes** — open an existing child note or create a new one. Notes
  are saved before switching or closing; when the note closes, chat fills the
  right column.
- **Selection-only questions** — chat answers from the current PDF selection
  and current question. The focused mode does not attach the whole paper,
  nearby passages, old chat turns, web search, tools, or other Zotero items.
- **Simple conversation UI** — questions appear on the right and answers on
  the left, using a shared warm neutral palette with the translation column.
- **Endpoint-first setup** — sign in with only a Base URL and API key. The
  add-on discovers model IDs from `/models`, tests the connection, and then
  lets you choose the model and its supported reasoning level before sending.

## Compatibility

| Component         | Supported                                                                          |
| ----------------- | ---------------------------------------------------------------------------------- |
| Operating systems | Windows, macOS, Linux                                                              |
| Zotero            | 7–10                                                                               |
| Core AI mode      | OpenAI-compatible API                                                              |
| API requirements  | Bearer key, `GET /models`, and a compatible Responses or Chat Completions endpoint |

The core three-column reader does not require Node.js or a separate browser.
The optional native “always on top” helper is currently Linux-only and needs
`wmctrl`; this does not affect the docked reader workspace.

## Install

Installation is the same on Windows, macOS, and Linux:

1. Download `paper-workbench-for-zotero.xpi` from
   [GitHub Releases](https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero/releases/latest).
2. In Zotero, open **Tools → Plugins**.
3. Open the gear menu and choose **Install Plugin From File…**.
4. Select the downloaded `.xpi` and restart Zotero if prompted.
5. Open a PDF attachment. The paper, translation, and work columns appear in
   the reader.

To update, install the newer XPI over the existing version and restart Zotero
if prompted.

## First sign-in

The first launch is deliberately signed out. The right column asks for:

- **Base URL** — for example, the `/v1` URL of an OpenAI-compatible service.
- **API Key** — the credential issued by that service.

There is no model-ID field on the sign-in screen. After you select **Sign in**,
the add-on:

1. requests the endpoint's `/models` list;
2. prefers `gpt-6.1-sol` when the endpoint offers it, otherwise selects the
   first returned model;
3. verifies that the selected model responds; and
4. saves the endpoint, key, discovered models, and authenticated state in the
   current local Zotero profile.

The composer then provides model and reasoning selectors. Available reasoning
levels depend on the chosen model and may include `low`, `medium`, `high`,
`xhigh`, and `max`.

Use **Sign out** to stop active requests, clear the saved API key and current
model selection, and return both AI and translation columns to the signed-out
state.

## Everyday use

### Translate a selection

1. Select an English sentence or paragraph in the PDF.
2. The middle column translates it automatically.
3. Select different text to replace the source and translation.

No translation request is sent while signed out.

### Ask about a selection

1. Select the exact PDF passage you want to discuss.
2. Optionally choose a model and reasoning level above the composer.
3. Send the default explanation request or type a question about the passage.
4. Read the answer in the left-side response bubble.

The send control stays disabled when there is no live PDF selection.

### Work with notes

1. Select **Note** in the right-column toolbar.
2. Choose an existing note or **New note**.
3. Edit the note above the chat.
4. Select **Close note** when finished. The add-on saves first, closes the note
   surface, and expands chat to the full column.

## Data and privacy

- The API key is stored in the current local Zotero profile. It is not embedded
  in the source tree, XPI, or release archives.
- Translation sends the selected text to the configured endpoint.
- Focused chat sends the current selection and current question to the
  configured endpoint. Previous turns remain visible locally but are not added
  to the next focused request.
- Zotero notes and library data remain managed by Zotero.
- Local profile files and configuration backups can contain credentials; do
  not publish or share them.

Review the privacy policy and retention terms of the endpoint you configure.

## Uninstall

1. Sign out first if you want the add-on to clear its saved API key.
2. Open **Tools → Plugins** in Zotero.
3. Open the add-on menu and choose **Remove**.
4. Restart Zotero if prompted.

Removing the add-on does not delete your Zotero library or Zotero notes.

## Development

Requirements: Node.js 22 and npm.

```bash
git clone https://github.com/TJR-USTC-HUB/paper-workbench-for-zotero.git
cd paper-workbench-for-zotero
npm ci
npm test
npm run build
```

Build artifacts are written to `.scaffold/build/`. Never commit `.env`, Zotero
profiles, API keys, or generated build directories.

The project uses a Windows/macOS/Linux CI matrix for tests and build smoke
checks. A release XPI is platform-independent and is packaged once by the
release workflow.

## License and upstream

Paper Workbench for Zotero is derived from
[xuhan-rgb/zotero-ai-sidebar](https://github.com/xuhan-rgb/zotero-ai-sidebar).
It retains the upstream license and notices and is distributed under
[AGPL-3.0-or-later](LICENSE). See the Git history and project files for detailed
authorship. Contributions to this repository are distributed under the same
license.
