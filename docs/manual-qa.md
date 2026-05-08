# NanoTranslator Manual QA

## Chrome setup

Use Chrome desktop. For local development, enable the built-in AI flags that match the APIs you want to test:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
- `chrome://flags/#writer-api-for-gemini-nano` for Writer/Rewriter when available
- `chrome://flags/#proofreader-api-for-gemini-nano` for Proofreader when available

Some APIs may require an origin trial or developer trial for extension IDs. The extension feature-detects each API and shows unsupported/unavailable states instead of failing.

## Load unpacked

1. Run `npm install`.
2. Run `npm run build`.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked and select the `dist` folder.

## Smoke tests

- With default settings, open a normal web page, select text, press `Shift`, and confirm a loading tooltip appears on the page followed by a translation result or a clear unavailable/error state.
- Open the popup `Language` tab, change `Ngôn ngữ đang dùng` and `Ngôn ngữ đích dịch`, and confirm direct page translation uses the selected language pair.
- Open General settings, change `Ngữ điệu văn bản`, and confirm Writer/Rewriter/Prompt use that tone as their default.
- Open the popup and click `Open settings page`; confirm the full settings page opens and saving language settings changes the same extension behavior.
- Open the side panel and click `Settings`; confirm the same full settings page opens.
- Set popup `General` tab `Shift action` to `Show tools menu`, select text, press `Shift`, and confirm the NanoTranslator action menu appears near the selection.
- Click Translate and confirm the side panel opens with the selected text.
- Run Translate. If the language pack is ready, the result appears; if not, the UI shows download/unavailable status.
- Switch tabs in the side panel and verify unsupported Writer/Rewriter/Proofreader APIs show a clear feature-gated message.
- In Prompt, upload an image and run a text prompt. If multimodal Prompt is unavailable, verify the UI reports that state.
- Open the popup, change target language and character limit, close and reopen the popup, and confirm settings persist.
- Confirm extension code does not make app-level network requests for AI inference; Chrome may use network only for first model or language-pack download.
