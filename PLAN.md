# NanoTranslator Full Tools Extension Plan

## Summary
Build a Chrome MV3 extension using `Vanilla TypeScript + Vite` that runs Chrome Built-in AI APIs on-device. The extension will use a selection-triggered mini menu plus a side panel: users select text, press `Shift`, then choose Translate, Summarize, Rewrite, Proofread, or send content to Prompt API. Prompt API v1 supports text plus user-selected/uploaded image; audio is out of v1.

Primary references: [Chrome Built-in AI overview](https://developer.chrome.com/docs/ai/built-in-apis), [Translator API](https://developer.chrome.com/docs/ai/translator-api), [Prompt API for extensions](https://developer.chrome.com/docs/extensions/ai/prompt-api), [Writer API](https://developer.chrome.com/docs/ai/writer-api), [Rewriter API](https://developer.chrome.com/docs/ai/rewriter-api), [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api).

## Key Changes
- Scaffold a Chrome MV3 extension with Vite, TypeScript, content script, service worker, popup, side panel, and shared AI adapter modules.
- Content script handles:
  - `mouseup` / selection detection.
  - `Shift` as the required activation key.
  - selection validation: trim whitespace, ignore selections under 5 chars, cap default at 500 chars for inline actions.
  - coordinates for a compact action menu near the selected text.
- Side panel handles long-running AI workflows:
  - Translate: `Translator.availability()`, `Translator.create({ sourceLanguage, targetLanguage })`, `translate()`.
  - Summarize: `Summarizer.availability()`, configurable type/length/format, streaming where useful.
  - Writer: new-content generation from prompt/context, feature-gated because current docs list it as trial/developer-trial.
  - Rewriter: tone/length/format controls, feature-gated.
  - Proofreader: corrections/labels/explanations where supported, feature-gated.
  - Prompt: freeform text prompt plus optional image input; no audio in v1.
- Popup settings include:
  - Extension on/off.
  - Target language, default `vi`.
  - Source language mode: `auto/manual`; if auto support is added, use Language Detector API, otherwise default to `en -> vi`.
  - Activation hint: “select text + Shift”.
  - Character limit.
  - API status dashboard showing `available`, `downloadable`, `downloading`, `unavailable`.
- Add a shared model/session layer:
  - Feature detection via `'Translator' in self`, `'Summarizer' in self`, etc.
  - Availability checks before create.
  - Download progress events surfaced in UI.
  - AbortController support for streaming/long tasks.
  - Session reuse per API/options where allowed; destroy sessions when options change or panel closes.
- Preserve privacy posture:
  - No external API keys.
  - No server calls for AI.
  - All AI actions run through Chrome’s on-device APIs; internet may be needed only for first model/language-pack download.

## Implementation Sequence
1. Create project baseline: `package.json`, Vite config, TS config, MV3 `manifest.json`, extension icons/placeholders, build scripts, and `@types/dom-chromium-ai`.
2. Implement content script selection capture and `Shift` activation menu, using isolated CSS/shadow DOM to avoid page style conflicts.
3. Implement storage-backed settings with `chrome.storage.sync`, popup UI, and defaults.
4. Implement side panel shell with task tabs/actions for Translate, Summarize, Writer, Rewriter, Proofreader, and Prompt.
5. Build AI adapters around each Chrome API with a common result shape: `idle/loading/downloading/success/error/unavailable`.
6. Connect selected page text from content script to side panel through `chrome.runtime` messaging.
7. Add Prompt API image flow: file picker or captured image input converted to supported image/blob input for `LanguageModel`.
8. Add robust UI states matching the existing mockup: loading, success, unavailable/model not ready, download progress, retry, copy result.
9. Add manual QA docs for Chrome flags/origin-trial constraints and local unpacked-extension loading.

## Test Plan
- Unit-test pure helpers: selection normalization, length validation, language option mapping, API availability normalization.
- Manual extension tests in Chrome desktop:
  - Select text, press `Shift`, action menu appears at correct location.
  - Translate EN -> VI succeeds when `Translator` is available.
  - Unsupported API shows “not supported / trial required” instead of crashing.
  - Downloadable/downloading states show progress and retry path.
  - Copy result works.
  - Settings persist after browser reload.
  - Side panel receives current selection and can run each enabled tool.
- Build validation:
  - `npm run build` produces loadable MV3 extension.
  - Load unpacked extension in Chrome with no console errors on normal pages.
  - Verify no network requests are made by extension AI logic.

## Assumptions
- Target browser is Chrome desktop, not mobile.
- MVP is not Chrome Web Store publication-ready; origin-trial tokens and final store assets can be added later.
- Writer/Rewriter/Proofreader are implemented behind runtime feature gates because their Chrome availability is less stable than Translator/Summarizer.
- Audio Prompt API support is deferred from v1.
- Existing `hover_translator_ui_mockup.html` and `hover_translator_architecture.svg` are design/architecture references, not production code to preserve exactly.
