import type { ExtensionSettings, NanoTool, RuntimeResponse, SelectedTextPayload } from "../shared/contracts";

const MENU_WIDTH = 340;
const MENU_HEIGHT = 86;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_HEIGHT = 126;
const SETTINGS_KEY = "nanotranslator.settings";
const defaultSettings: ExtensionSettings = {
  enabled: true,
  targetLanguage: "vi",
  sourceLanguage: "en",
  sourceLanguageMode: "manual",
  shiftAction: "directTranslate",
  textTone: "neutral",
  characterLimit: 500
};
const tools: Array<{ id: NanoTool; label: string }> = [
  { id: "translate", label: "Translate" },
  { id: "summarize", label: "Summarize" },
  { id: "writer", label: "Write" },
  { id: "rewriter", label: "Rewrite" },
  { id: "proofreader", label: "Proofread" },
  { id: "prompt", label: "Prompt" }
];

let settings: ExtensionSettings | null = null;
let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let activeSelection: { text: string; rect: DOMRect } | null = null;
let translateRequestId = 0;

void initialize();

async function initialize(): Promise<void> {
  settings = await getSettings();
  onSettingsChanged((nextSettings) => {
    settings = nextSettings;
    if (!nextSettings.enabled) {
      hideMenu();
    }
  });

  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("pointerdown", handleOutsidePointer, true);
  document.addEventListener("mousedown", handleOutsidePointer, true);
  document.addEventListener("click", handleOutsidePointer, true);
  window.addEventListener("pointerdown", handleOutsidePointer, true);
  window.addEventListener("mousedown", handleOutsidePointer, true);
  window.addEventListener("click", handleOutsidePointer, true);
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("selectionchange", () => {
    if (!document.getSelection()?.toString()) {
      hideMenu();
    }
  });
}

async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...defaultSettings, ...(result[SETTINGS_KEY] ?? {}) };
}

function onSettingsChanged(callback: (settings: ExtensionSettings) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[SETTINGS_KEY]?.newValue) {
      return;
    }
    callback({ ...defaultSettings, ...changes[SETTINGS_KEY].newValue });
  });
}

function handleMouseUp(event: MouseEvent): void {
  if (!event.shiftKey) {
    return;
  }

  updateSelectionAndMenu();
}

function handleOutsidePointer(event: Event): void {
  if (!host || host.hidden) {
    return;
  }

  if (event.composedPath().includes(host)) {
    return;
  }

  hideMenu();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideMenu();
    return;
  }

  if (event.key !== "Shift" || event.repeat) {
    return;
  }

  updateSelectionAndMenu();
}

function updateSelectionAndMenu(): void {
  if (!settings?.enabled) {
    return;
  }

  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) {
    hideMenu();
    return;
  }

  const validation = validateSelectionText(selection.toString(), settings.characterLimit);
  if (!validation.ok) {
    hideMenu();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = getSelectionRect(range);
  if (!rect) {
    hideMenu();
    return;
  }

  activeSelection = { text: validation.text, rect };
  if (settings.shiftAction === "directTranslate") {
    void translateOnPage(validation.reason === "too-long");
    return;
  }

  showMenu(validation.reason === "too-long");
}

function getSelectionRect(range: Range): DOMRect | null {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  return rects[0] ?? null;
}

function normalizeSelectionText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function validateSelectionText(input: string, limit: number, minLength = 5) {
  const text = normalizeSelectionText(input);
  if (!text) {
    return { ok: false, text, reason: "empty" as const };
  }
  if (text.length < minLength) {
    return { ok: false, text, reason: "too-short" as const };
  }
  if (text.length > limit) {
    return { ok: true, text: text.slice(0, limit), reason: "too-long" as const };
  }
  return { ok: true, text };
}

function clampToViewport(left: number, top: number, width: number, height: number): { left: number; top: number } {
  const margin = 10;
  return {
    left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(top, window.innerHeight - height - margin))
  };
}

function showMenu(wasTrimmed: boolean): void {
  if (!activeSelection) {
    return;
  }

  ensureShadow();
  if (!host || !shadow) {
    return;
  }

  const position = clampToViewport(activeSelection.rect.left, activeSelection.rect.top - MENU_HEIGHT - 10, MENU_WIDTH, MENU_HEIGHT);
  showHost();

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .menu {
        position: fixed;
        left: ${position.left}px;
        top: ${position.top}px;
        box-sizing: border-box;
        width: ${MENU_WIDTH}px;
        min-height: ${MENU_HEIGHT}px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 8px;
        background: #ffffff;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 8px;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
        color: #172033;
        font: 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 6px;
        padding: 7px 8px;
        background: #f3f6fb;
        color: #26344f;
        cursor: pointer;
        font: inherit;
        white-space: nowrap;
      }
      button:hover { background: #e5edf9; color: #0c4a7f; }
      .note {
        margin-left: auto;
        color: #7a8496;
        font-size: 11px;
      }
    </style>
    <div class="menu" role="menu" aria-label="NanoTranslator actions">
      ${tools.map((tool) => `<button type="button" data-tool="${tool.id}" role="menuitem">${tool.label}</button>`).join("")}
      ${wasTrimmed ? `<span class="note">${settings?.characterLimit ?? 500} chars</span>` : ""}
    </div>
  `;

  shadow.querySelectorAll<HTMLButtonElement>("button[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.tool as NanoTool;
      void openTool(tool);
    });
  });
}

function ensureShadow(): void {
  if (host && shadow) {
    return;
  }

  host = document.createElement("div");
  host.id = "nanotranslator-menu-host";
  host.hidden = true;
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  host.style.setProperty("left", "0", "important");
  host.style.setProperty("top", "0", "important");
  host.style.setProperty("width", "0", "important");
  host.style.setProperty("height", "0", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("border", "0", "important");
  host.style.setProperty("background", "transparent", "important");
  host.style.setProperty("pointer-events", "none", "important");
  host.style.setProperty("display", "none", "important");
  host.style.setProperty("visibility", "hidden", "important");
  document.documentElement.append(host);
  shadow = host.attachShadow({ mode: "open" });
}

function showHost(): void {
  if (!host) {
    return;
  }

  host.hidden = false;
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("visibility", "visible", "important");
}

function hideMenu(): void {
  translateRequestId++;
  activeSelection = null;
  if (host) {
    host.hidden = true;
    host.style.setProperty("display", "none", "important");
    host.style.setProperty("visibility", "hidden", "important");
  }
  if (shadow) {
    shadow.innerHTML = "";
  }
}

async function translateOnPage(wasTrimmed: boolean): Promise<void> {
  if (!activeSelection || !settings) {
    return;
  }

  const requestId = ++translateRequestId;
  const initialSourceLanguage = settings.sourceLanguageMode === "auto" ? "auto" : settings.sourceLanguage;
  showTranslationTooltip("loading", "Detecting language...", wasTrimmed, initialSourceLanguage);

  try {
    const sourceLanguage = await resolveDirectSourceLanguage(activeSelection.text, settings);
    if (requestId !== translateRequestId) {
      return;
    }
    showTranslationTooltip("loading", "Translating on-device...", wasTrimmed, sourceLanguage);
    const output = await runDirectTranslate(activeSelection.text, settings, sourceLanguage);
    if (requestId !== translateRequestId) {
      return;
    }
    showTranslationTooltip("success", output, wasTrimmed, sourceLanguage);
  } catch (error) {
    if (requestId !== translateRequestId) {
      return;
    }
    showTranslationTooltip("error", error instanceof Error ? error.message : String(error), wasTrimmed, initialSourceLanguage);
  }
}

async function resolveDirectSourceLanguage(text: string, currentSettings: ExtensionSettings): Promise<string> {
  if (currentSettings.sourceLanguageMode === "manual") {
    return currentSettings.sourceLanguage;
  }

  const heuristicLanguage = detectLanguageByScript(text);
  if (heuristicLanguage) {
    return heuristicLanguage;
  }

  const ai = globalThis as typeof globalThis & {
    LanguageDetector?: {
      availability?: (options?: Record<string, unknown>) => Promise<unknown>;
      create?: (options?: Record<string, unknown>) => Promise<any>;
    };
  };

  if (!ai.LanguageDetector?.create) {
    return currentSettings.sourceLanguage;
  }

  try {
    const availability = await ai.LanguageDetector.availability?.();
    if (availability === "unavailable") {
      return currentSettings.sourceLanguage;
    }

    const detector = await ai.LanguageDetector.create();
    const detections = await detector.detect(text);
    detector.destroy?.();
    const best = Array.isArray(detections) ? detections[0] : undefined;
    return best?.detectedLanguage ?? best?.language ?? currentSettings.sourceLanguage;
  } catch {
    return currentSettings.sourceLanguage;
  }
}

function detectLanguageByScript(text: string): string | null {
  if (/[\u3040-\u30ff]/u.test(text)) {
    return "ja";
  }

  if (/[\uac00-\ud7af]/u.test(text)) {
    return "ko";
  }

  if (/[\u4e00-\u9fff]/u.test(text)) {
    return "zh";
  }

  return null;
}

async function runDirectTranslate(text: string, currentSettings: ExtensionSettings, sourceLanguage: string): Promise<string> {
  const ai = globalThis as typeof globalThis & {
    Translator?: {
      availability?: (options?: Record<string, unknown>) => Promise<unknown>;
      create?: (options?: Record<string, unknown>) => Promise<any>;
    };
  };

  if (!ai.Translator?.create) {
    throw new Error("Translator API is not available in this Chrome context.");
  }

  const targetLanguage = currentSettings.targetLanguage;
  const availability = await ai.Translator.availability?.({ sourceLanguage, targetLanguage });

  if (availability === "unavailable") {
    throw new Error(`Translation is unavailable for ${sourceLanguage} -> ${targetLanguage}.`);
  }

  const translator = await ai.Translator.create({
    sourceLanguage,
    targetLanguage,
    monitor: (monitor: EventTarget) => {
      monitor.addEventListener("downloadprogress", (event) => {
        const progressEvent = event as ProgressEvent;
        const loaded = Number(progressEvent.loaded);
        const total = Number(progressEvent.total);
        const progress = Number.isFinite(total) && total > 0 ? Math.round((loaded / total) * 100) : Math.round(loaded * 100);
        showTranslationTooltip("loading", `Downloading model ${Math.max(0, Math.min(100, progress))}%...`, false, sourceLanguage);
      });
    }
  });

  try {
    return String(await translator.translate(text));
  } finally {
    translator.destroy?.();
  }
}

function showTranslationTooltip(status: "loading" | "success" | "error", message: string, wasTrimmed: boolean, sourceLanguage = settings?.sourceLanguage ?? "en"): void {
  if (!activeSelection) {
    return;
  }

  ensureShadow();
  if (!host || !shadow) {
    return;
  }

  const position = clampToViewport(activeSelection.rect.left, activeSelection.rect.top - TOOLTIP_HEIGHT - 10, TOOLTIP_WIDTH, TOOLTIP_HEIGHT);
  showHost();

  const escapedMessage = escapeHtml(message);
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .tooltip {
        position: fixed;
        left: ${position.left}px;
        top: ${position.top}px;
        box-sizing: border-box;
        width: ${TOOLTIP_WIDTH}px;
        padding: 11px 13px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
        color: #172033;
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
      }
      .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 7px;
        color: #68758b;
        font-size: 11px;
      }
      .body {
        min-height: 24px;
        color: ${status === "error" ? "#8a2d1b" : "#172033"};
        font-weight: ${status === "success" ? "600" : "400"};
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .bar {
        height: 4px;
        margin-top: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: #e8eef7;
      }
      .bar span {
        display: block;
        width: 58%;
        height: 100%;
        border-radius: inherit;
        background: #1d9e75;
        animation: load 900ms ease-in-out infinite alternate;
      }
      .actions {
        display: flex;
        gap: 7px;
        margin-top: 9px;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 6px;
        padding: 6px 8px;
        background: #f3f6fb;
        color: #26344f;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
      }
      button:hover { background: #e5edf9; color: #0c4a7f; }
      @keyframes load { from { transform: translateX(-45%); } to { transform: translateX(85%); } }
    </style>
    <div class="tooltip" role="status" aria-live="polite">
      <div class="meta">
        <span>${sourceLanguage.toUpperCase()} -> ${settings?.targetLanguage.toUpperCase() ?? "VI"}</span>
        <span>${wasTrimmed ? `${settings?.characterLimit ?? 500} chars` : status}</span>
      </div>
      <div class="body">${escapedMessage}</div>
      ${status === "loading" ? `<div class="bar"><span></span></div>` : ""}
      <div class="actions">
        ${status === "success" ? `<button type="button" data-action="copy">Copy</button>` : ""}
        <button type="button" data-action="open">Open tools</button>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
  `;

  shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener("click", () => {
    void navigator.clipboard.writeText(message);
  });
  shadow.querySelector<HTMLButtonElement>('[data-action="open"]')?.addEventListener("click", () => {
    void openTool("translate");
  });
  shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideMenu();
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function openTool(tool: NanoTool): Promise<void> {
  if (!activeSelection) {
    return;
  }

  const payload: SelectedTextPayload = {
    text: activeSelection.text,
    tool,
    pageUrl: location.href,
    pageTitle: document.title,
    createdAt: Date.now()
  };

  await chrome.runtime.sendMessage({ type: "OPEN_TOOL", payload }).then((response: RuntimeResponse) => {
    if (!response?.ok) {
      throw new Error(response?.error ?? "Unable to open NanoTranslator side panel.");
    }
  });
  hideMenu();
}
