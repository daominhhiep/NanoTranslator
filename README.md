# NanoTranslator

NanoTranslator is a Chrome MV3 extension that uses Chrome Built-in AI APIs for on-device translation and writing tools. It does not use external AI API keys or send selected text to a server.

## Features

- Select text on a page, press `Shift`, and translate directly on the page by default.
- Translate selected text with Chrome's `Translator` API.
- Summarize, write, rewrite, proofread, and prompt with feature-gated Built-in AI APIs.
- Use the Prompt API with text and an optional image upload.
- Configure current/source language, target translation language, Shift behavior, text tone, enable/disable state, and character limit from popup tabs.
- Open a full settings page from the extension popup or Chrome's extension details page.
- View API availability from the popup.

## Requirements

- Chrome desktop, version 138 or newer.
- Node.js 20 or newer recommended.
- Built-in AI availability depends on Chrome version, device capability, flags, and for some APIs, origin/developer trials.

Useful local flags:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
- `chrome://flags/#writer-api-for-gemini-nano`
- `chrome://flags/#proofreader-api-for-gemini-nano`

After changing flags, relaunch Chrome. Some models or language packs may need a one-time download before offline use.

## Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

The production extension is generated in:

```text
dist/
```

## Run Tests

```bash
npm test
```

## Load Unpacked Extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the `dist` folder.
6. Open a web page, select text, press `Shift`, then confirm the translation tooltip appears on the page.

The default behavior follows Ddict's interaction model: select text and press `Shift` to translate in place. To change languages, open the popup and use the `Language` tab. To restore the old menu behavior, open the popup, go to `General`, and set `Shift action` to `Show tools menu`.

For the full settings page, open the extension popup and click `Open settings page`, click `Settings` in the side panel, or go to `chrome://extensions` > NanoTranslator > Details > Extension options.

Do not select the project root folder `NanoTranslator`. Chrome must load the built extension folder:

```text
/Users/daominhhiep/Desktop/Extension/NanoTranslator/dist
```

If Chrome shows `Manifest file is missing or unreadable`, it usually means the wrong folder was selected. The selected folder must contain `manifest.json` directly at its top level.

## Create Chrome Web Store Zip

Build first:

```bash
npm run build
```

Create a zip from the contents of `dist`, not the project root:

```bash
npm run zip
```

The upload artifact will be:

```text
nanotranslator-chrome-store.zip
```

Check the zip contents:

```bash
unzip -l nanotranslator-chrome-store.zip
```

The zip should contain `manifest.json`, `popup.html`, `options.html`, `sidepanel.html`, and the `assets/` folder at the top level. It should not contain `node_modules`, source files, `.git`, or the parent `dist/` folder.

Equivalent manual command:

```bash
cd dist
zip -r ../nanotranslator-chrome-store.zip .
cd ..
```

## Troubleshooting

### Manifest file is missing or unreadable

Check these points:

- Run `npm run build` before loading the extension.
- In `chrome://extensions`, choose `Load unpacked`, then select `NanoTranslator/dist`, not `NanoTranslator`.
- Confirm this file exists:

```text
/Users/daominhhiep/Desktop/Extension/NanoTranslator/dist/manifest.json
```

- If you upload a zip to Chrome Web Store, zip the contents of `dist`, not the `dist` folder itself.
- If you changed files after building, run `npm run build` again.

### Chrome version or API not supported

If the extension loads but some AI tools show unavailable/unsupported, check Chrome version and Built-in AI flags. This is different from a missing manifest error.

## Chrome Web Store Upload Notes

Before uploading, review:

- `public/manifest.json` version number.
- Extension name and description.
- Store screenshots, icons, privacy disclosure, and support URL.
- Whether any Built-in AI APIs used by the extension require origin trial tokens for the target Chrome version.
- Whether the requested permissions are still minimal for the shipped scope.

This MVP intentionally ships without external AI providers. The privacy posture should state that AI inference runs through Chrome's on-device Built-in AI APIs, while Chrome may download required models or language packs separately.

## Manual QA

See [docs/manual-qa.md](docs/manual-qa.md) for a focused checklist covering API flags, unpacked loading, and smoke tests.

## Project Structure

```text
src/background/   MV3 service worker
src/content/      Selection detection and page action menu
src/popup/        Popup settings and API status
src/options/      Full extension settings page
src/sidepanel/    Long-running AI tool UI
src/shared/       Settings, contracts, helpers, and Built-in AI adapters
tests/            Unit tests
public/           Extension manifest
docs/             Manual QA notes
```
