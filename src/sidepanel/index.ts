import {
  getApiStatus,
  runPrompt,
  runProofreader,
  runRewriter,
  runSummarize,
  runTranslate,
  runWriter,
  type RewriterOptions,
  type SummarizeOptions,
  type WriterOptions
} from "../shared/chromeAi";
import { aiUnavailableMessage, hasUsableAiApi, isToolUsable, toolUnavailableReason } from "../shared/aiStatus";
import type { ApiStatusSnapshot, ExtensionSettings } from "../shared/contracts";
import type { AiTaskResult, NanoTool, RuntimeResponse, SelectedTextPayload } from "../shared/contracts";
import { getSettings } from "../shared/settings";
import { mapToRewriterTone, mapToWriterTone, promptToneInstruction, textToneLabel } from "../shared/textTone";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
const tabs: Array<{ id: NanoTool; label: string }> = [
  { id: "translate", label: "Translate" },
  { id: "summarize", label: "Summarize" },
  { id: "writer", label: "Write" },
  { id: "rewriter", label: "Rewrite" },
  { id: "proofreader", label: "Proofread" },
  { id: "prompt", label: "Prompt" }
];

let selection: SelectedTextPayload | null = null;
let activeTool: NanoTool = "translate";
let result: AiTaskResult = { status: "idle", output: "" };
let promptImage: Blob | undefined;
let promptImageName = "";
let statuses: ApiStatusSnapshot | null = null;
let extensionSettings: ExtensionSettings | null = null;

void initialize();

async function initialize(): Promise<void> {
  extensionSettings = await getSettings();
  selection = await getSelectionPayload();
  activeTool = selection?.tool ?? "translate";
  render();
  void refreshStatus();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session" && changes["nanotranslator.currentSelection"]?.newValue) {
      selection = changes["nanotranslator.currentSelection"].newValue;
      activeTool = selection?.tool ?? activeTool;
      result = { status: "idle", output: "" };
      render();
    }
    if (areaName === "sync" && changes["nanotranslator.settings"]?.newValue) {
      extensionSettings = { ...extensionSettings, ...changes["nanotranslator.settings"].newValue };
      render();
    }
  });
}

async function refreshStatus(): Promise<void> {
  extensionSettings = await getSettings();
  statuses = await getApiStatus(extensionSettings);
  render();
}

async function getSelectionPayload(): Promise<SelectedTextPayload | null> {
  const response = await chrome.runtime.sendMessage({ type: "GET_SELECTION" }) as RuntimeResponse<SelectedTextPayload | null>;
  return response.ok ? response.data ?? null : null;
}

function render(): void {
  if (!app) {
    return;
  }

  app.innerHTML = `
    <section class="panel">
      <header>
        <div>
          <h1>NanoTranslator</h1>
          <p>${selection ? escapeHtml(selection.pageTitle || selection.pageUrl) : "Select text on a page and press Shift."}</p>
        </div>
        <button id="openSettings" class="settings-button" type="button" title="Open settings">Settings</button>
      </header>

      ${renderAiWarning()}

      <nav class="tabs" aria-label="Nano tools">
        ${tabs.map((tab) => {
          const usable = isToolUsable(tab.id, statuses);
          const reason = usable ? "" : toolUnavailableReason(tab.id, statuses);
          const titleAttr = reason ? ` title="${escapeHtml(reason)}" aria-disabled="true"` : "";
          const disabledAttr = usable ? "" : " disabled";
          return `<button type="button" data-tab="${tab.id}" class="${tab.id === activeTool ? "active" : ""}"${disabledAttr}${titleAttr}>${tab.label}</button>`;
        }).join("")}
      </nav>

      <section class="selection">
        <div class="section-title">
          <span>Input</span>
          <small>${selection?.text.length ?? 0} chars</small>
        </div>
        <textarea id="inputText" spellcheck="false">${escapeHtml(selection?.text ?? "")}</textarea>
      </section>

      <form id="toolForm">
        ${renderToolControls()}
        <div class="actions">
          ${(() => {
            const usable = isToolUsable(activeTool, statuses);
            const reason = usable ? "" : toolUnavailableReason(activeTool, statuses);
            const titleAttr = reason ? ` title="${escapeHtml(reason)}"` : "";
            return `<button class="primary" type="submit"${usable ? "" : " disabled"}${titleAttr}>${buttonLabel()}</button>`;
          })()}
          <button id="copy" type="button" ${result.output ? "" : "disabled"}>Copy result</button>
        </div>
      </form>

      ${renderResult()}
    </section>
  `;

  bindEvents();
}

function renderAiWarning(): string {
  if (hasUsableAiApi(statuses)) {
    return "";
  }

  return `
    <section class="ai-warning" role="alert">
      <strong>AI unavailable</strong>
      <p>${aiUnavailableMessage()}</p>
      <button id="refreshAiStatus" type="button">Check again</button>
    </section>
  `;
}

function renderToolControls(): string {
  switch (activeTool) {
    case "translate":
      return `<p class="hint">Translates from the configured source language to your popup target language.</p>`;

    case "summarize":
      return `
        <div class="control-grid">
          ${selectControl("summaryType", "Type", [["key-points", "Key points"], ["tldr", "TL;DR"], ["teaser", "Teaser"], ["headline", "Headline"]])}
          ${selectControl("summaryLength", "Length", [["short", "Short"], ["medium", "Medium"], ["long", "Long"]])}
          ${selectControl("summaryFormat", "Format", [["markdown", "Markdown"], ["plain-text", "Plain text"]])}
        </div>
      `;

    case "writer":
      return `
        <label class="stacked">
          <span>Context</span>
          <textarea id="writerContext" rows="3" placeholder="Optional context for the generated text"></textarea>
        </label>
        <div class="control-grid">
          ${selectControl("writerTone", "Tone", [["formal", "Formal"], ["neutral", "Neutral"], ["casual", "Casual"]], writerToneDefault())}
          ${selectControl("writerLength", "Length", [["short", "Short"], ["medium", "Medium"], ["long", "Long"]])}
          ${selectControl("writerFormat", "Format", [["markdown", "Markdown"], ["plain-text", "Plain text"]])}
        </div>
        <p class="hint">Default tone from settings: ${escapeHtml(textToneLabel(extensionSettings?.textTone ?? "neutral"))}.</p>
      `;

    case "rewriter":
      return `
        <label class="stacked">
          <span>Context</span>
          <textarea id="rewriterContext" rows="3" placeholder="Optional context for how to rewrite"></textarea>
        </label>
        <div class="control-grid">
          ${selectControl("rewriterTone", "Tone", [["as-is", "As-is"], ["more-formal", "More formal"], ["more-casual", "More casual"]], rewriterToneDefault())}
          ${selectControl("rewriterLength", "Length", [["as-is", "As-is"], ["shorter", "Shorter"], ["longer", "Longer"]])}
          ${selectControl("rewriterFormat", "Format", [["as-is", "As-is"], ["markdown", "Markdown"], ["plain-text", "Plain text"]])}
        </div>
        <p class="hint">Default tone from settings: ${escapeHtml(textToneLabel(extensionSettings?.textTone ?? "neutral"))}.</p>
      `;

    case "proofreader":
      return `<p class="hint">Returns corrections and explanations when the Proofreader API is available.</p>`;

    case "prompt":
      return `
        <label class="stacked">
          <span>Image input</span>
          <input id="promptImage" type="file" accept="image/*" />
          <small>${promptImageName ? escapeHtml(promptImageName) : "Optional image; audio is not part of v1."}</small>
        </label>
        <p class="hint">Prompt output tone: ${escapeHtml(textToneLabel(extensionSettings?.textTone ?? "neutral"))}.</p>
      `;
  }
}

function renderResult(): string {
  const progress = Math.round((result.progress ?? 0) * 100);

  return `
    <section class="result" data-status="${result.status}">
      <div class="section-title">
        <span>Result</span>
        <small>${statusLabel(progress)}</small>
      </div>
      ${result.status === "downloading" ? `<div class="progress"><span style="width:${progress}%"></span></div>` : ""}
      ${result.detail ? `<p class="detail">${escapeHtml(result.detail)}</p>` : ""}
      <pre>${escapeHtml(result.output || placeholderText())}</pre>
    </section>
  `;
}

function statusLabel(progress: number): string {
  if (result.status === "downloading") {
    return `Downloading ${progress}%`;
  }
  return result.status;
}

function placeholderText(): string {
  if (result.status === "idle") {
    return "Run a tool to see the on-device result here.";
  }
  if (result.status === "loading") {
    return "Working on-device...";
  }
  return "";
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTool = button.dataset.tab as NanoTool;
      result = { status: "idle", output: "" };
      render();
    });
  });

  document.querySelector<HTMLFormElement>("#toolForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runActiveTool();
  });

  document.querySelector<HTMLButtonElement>("#copy")?.addEventListener("click", async () => {
    if (result.output) {
      await navigator.clipboard.writeText(result.output);
    }
  });

  document.querySelector<HTMLInputElement>("#promptImage")?.addEventListener("change", async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    promptImage = file;
    promptImageName = file?.name ?? "";
    render();
  });

  document.querySelector<HTMLButtonElement>("#openSettings")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });

  document.querySelector<HTMLButtonElement>("#refreshAiStatus")?.addEventListener("click", () => {
    void refreshStatus();
  });
}

async function runActiveTool(): Promise<void> {
  if (!isToolUsable(activeTool, statuses)) {
    result = { status: "unavailable", output: "", detail: toolUnavailableReason(activeTool, statuses) };
    render();
    return;
  }

  const input = document.querySelector<HTMLTextAreaElement>("#inputText")?.value.trim() ?? "";
  if (!input) {
    result = { status: "error", output: "", detail: "Input is empty." };
    render();
    return;
  }

  result = { status: "loading", output: "" };
  render();

  const settings = await getSettings();
  const onProgress = (progress: number) => {
    result = { status: "downloading", output: "", progress };
    render();
  };

  if (activeTool === "translate") {
    result = await runTranslate(input, settings, onProgress);
  } else if (activeTool === "summarize") {
    result = await runSummarize(input, getSummarizeOptions(), onProgress);
  } else if (activeTool === "writer") {
    result = await runWriter(input, getWriterOptions(), onProgress);
  } else if (activeTool === "rewriter") {
    result = await runRewriter(input, getRewriterOptions(), onProgress);
  } else if (activeTool === "proofreader") {
    result = await runProofreader(input, settings.sourceLanguageMode === "manual" ? settings.sourceLanguage : "en", onProgress);
  } else {
    result = await runPrompt(`${promptToneInstruction(settings.textTone)}\n\n${input}`, promptImage, onProgress);
  }

  render();
}

function getSummarizeOptions(): SummarizeOptions {
  return {
    type: valueOf("summaryType", "key-points") as SummarizeOptions["type"],
    length: valueOf("summaryLength", "short") as SummarizeOptions["length"],
    format: valueOf("summaryFormat", "markdown") as SummarizeOptions["format"]
  };
}

function getWriterOptions(): WriterOptions {
  return {
    tone: valueOf("writerTone", writerToneDefault()) as WriterOptions["tone"],
    length: valueOf("writerLength", "medium") as WriterOptions["length"],
    format: valueOf("writerFormat", "markdown") as WriterOptions["format"],
    context: document.querySelector<HTMLTextAreaElement>("#writerContext")?.value ?? ""
  };
}

function getRewriterOptions(): RewriterOptions {
  return {
    tone: valueOf("rewriterTone", rewriterToneDefault()) as RewriterOptions["tone"],
    length: valueOf("rewriterLength", "as-is") as RewriterOptions["length"],
    format: valueOf("rewriterFormat", "as-is") as RewriterOptions["format"],
    context: document.querySelector<HTMLTextAreaElement>("#rewriterContext")?.value ?? ""
  };
}

function valueOf(id: string, fallback: string): string {
  return document.querySelector<HTMLSelectElement>(`#${id}`)?.value ?? fallback;
}

function writerToneDefault(): WriterOptions["tone"] {
  return mapToWriterTone(extensionSettings?.textTone ?? "neutral");
}

function rewriterToneDefault(): RewriterOptions["tone"] {
  return mapToRewriterTone(extensionSettings?.textTone ?? "neutral");
}

function selectControl(id: string, label: string, options: Array<[string, string]>, selectedValue?: string): string {
  return `
    <label>
      <span>${label}</span>
      <select id="${id}">
        ${options.map(([value, text]) => `<option value="${value}" ${selectedValue === value ? "selected" : ""}>${text}</option>`).join("")}
      </select>
    </label>
  `;
}

function buttonLabel(): string {
  if (activeTool === "translate") {
    return "Translate";
  }
  return tabs.find((tab) => tab.id === activeTool)?.label ?? "Run";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
