import { getApiStatus } from "../shared/chromeAi";
import { aiUnavailableMessage, hasUsableAiApi } from "../shared/aiStatus";
import type { ApiStatusSnapshot, ExtensionSettings } from "../shared/contracts";
import { languageOptions } from "../shared/languages";
import { getSettings, saveSettings } from "../shared/settings";
import { textToneOptions } from "../shared/textTone";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
let settings: ExtensionSettings;
let statuses: ApiStatusSnapshot | null = null;
let activeTab: "general" | "languages" | "status" = "general";

void initialize();

async function initialize(): Promise<void> {
  settings = await getSettings();
  render();
  void refreshStatus();
}

async function refreshStatus(): Promise<void> {
  statuses = await getApiStatus(settings);
  render();
}

function render(): void {
  if (!app || !settings) {
    return;
  }

  app.innerHTML = `
    <section class="popup">
      <header>
        <div>
          <h1>NanoTranslator</h1>
          <p>Select text, then press Shift to translate.</p>
        </div>
        <label class="switch" aria-label="Enable extension">
          <input id="enabled" type="checkbox" ${settings.enabled ? "checked" : ""} />
          <span></span>
        </label>
      </header>

      ${renderAiWarning()}

      <nav class="popup-tabs" aria-label="Settings tabs">
        ${tabButton("general", "General")}
        ${tabButton("languages", "Language")}
        ${tabButton("status", "Status")}
      </nav>

      <section class="tab-panel">
        ${renderActiveTab()}
      </section>

      <footer>
        <button id="openOptions" type="button">Open settings page</button>
      </footer>
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
    </section>
  `;
}

function tabButton(tab: typeof activeTab, label: string): string {
  return `<button type="button" data-tab="${tab}" class="${activeTab === tab ? "active" : ""}">${label}</button>`;
}

function renderActiveTab(): string {
  if (activeTab === "languages") {
    return renderLanguageSettings();
  }

  if (activeTab === "status") {
    return renderStatusSettings();
  }

  return renderGeneralSettings();
}

function renderGeneralSettings(): string {
  return `
    <label>
      <span>Shift action</span>
      <select id="shiftAction">
        <option value="directTranslate" ${settings.shiftAction === "directTranslate" ? "selected" : ""}>Translate directly on page</option>
        <option value="menu" ${settings.shiftAction === "menu" ? "selected" : ""}>Show tools menu</option>
      </select>
    </label>

    <label>
      <span>Character limit</span>
      <input id="characterLimit" type="number" min="50" max="5000" step="50" value="${settings.characterLimit}" />
    </label>

    <label>
      <span>Ngữ điệu văn bản</span>
      <select id="textTone">
        ${textToneOptions.map((tone) => `<option value="${tone.value}" ${settings.textTone === tone.value ? "selected" : ""}>${tone.label}</option>`).join("")}
      </select>
    </label>

    <p class="muted block-note">Ddict-style mode: select text on any page and press Shift to translate in place. Ngữ điệu áp dụng cho Write, Rewrite và Prompt; Chrome Translator API không hỗ trợ chỉnh tone trực tiếp.</p>
  `;
}

function renderLanguageSettings(): string {
  return `
    <label>
      <span>Ngôn ngữ đang dùng</span>
      <div class="inline">
        <select id="sourceLanguageMode">
          <option value="manual" ${settings.sourceLanguageMode === "manual" ? "selected" : ""}>Chọn thủ công</option>
          <option value="auto" ${settings.sourceLanguageMode === "auto" ? "selected" : ""}>Tự nhận diện</option>
        </select>
        <select id="sourceLanguage" ${settings.sourceLanguageMode === "auto" ? "disabled" : ""}>
          ${languageOptions.map((language) => `<option value="${language.code}" ${settings.sourceLanguage === language.code ? "selected" : ""}>${language.label}</option>`).join("")}
        </select>
      </div>
    </label>

    <label>
      <span>Ngôn ngữ đích dịch</span>
      <select id="targetLanguage">
        ${languageOptions.map((language) => `<option value="${language.code}" ${settings.targetLanguage === language.code ? "selected" : ""}>${language.label}</option>`).join("")}
      </select>
    </label>

    <p class="muted block-note">Khi bấm Shift, NanoTranslator dịch từ ngôn ngữ đang dùng sang ngôn ngữ đích.</p>
  `;
}

function renderStatusSettings(): string {
  return `
    <section class="status">
      <div class="status-title">
        <h2>API status</h2>
        <button id="refresh" type="button">Refresh</button>
      </div>
      ${renderStatuses()}
    </section>
  `;
}

function renderStatuses(): string {
  if (!statuses) {
    return `<p class="muted">Checking APIs...</p>`;
  }

  return Object.entries(statuses)
    .map(([name, status]) => `<div class="status-row"><span>${name}</span><strong data-status="${status}">${status}</strong></div>`)
    .join("");
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab as typeof activeTab;
      render();
    });
  });

  document.querySelector<HTMLInputElement>("#enabled")?.addEventListener("change", async (event) => {
    settings.enabled = (event.currentTarget as HTMLInputElement).checked;
    await saveSettings(settings);
  });

  document.querySelector<HTMLSelectElement>("#targetLanguage")?.addEventListener("change", async (event) => {
    settings.targetLanguage = (event.currentTarget as HTMLSelectElement).value;
    await saveSettings(settings);
    void refreshStatus();
  });

  document.querySelector<HTMLSelectElement>("#sourceLanguage")?.addEventListener("change", async (event) => {
    settings.sourceLanguage = (event.currentTarget as HTMLSelectElement).value;
    await saveSettings(settings);
    void refreshStatus();
  });

  document.querySelector<HTMLSelectElement>("#sourceLanguageMode")?.addEventListener("change", async (event) => {
    settings.sourceLanguageMode = (event.currentTarget as HTMLSelectElement).value as ExtensionSettings["sourceLanguageMode"];
    await saveSettings(settings);
    render();
    void refreshStatus();
  });

  document.querySelector<HTMLSelectElement>("#shiftAction")?.addEventListener("change", async (event) => {
    settings.shiftAction = (event.currentTarget as HTMLSelectElement).value as ExtensionSettings["shiftAction"];
    await saveSettings(settings);
  });

  document.querySelector<HTMLInputElement>("#characterLimit")?.addEventListener("change", async (event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    settings.characterLimit = Math.max(50, Math.min(5000, value || 500));
    await saveSettings(settings);
    render();
  });

  document.querySelector<HTMLSelectElement>("#textTone")?.addEventListener("change", async (event) => {
    settings.textTone = (event.currentTarget as HTMLSelectElement).value as ExtensionSettings["textTone"];
    await saveSettings(settings);
  });

  document.querySelector<HTMLButtonElement>("#refresh")?.addEventListener("click", () => {
    statuses = null;
    render();
    void refreshStatus();
  });

  document.querySelector<HTMLButtonElement>("#openOptions")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
    window.close();
  });
}
