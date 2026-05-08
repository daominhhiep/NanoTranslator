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
let activeTab: "general" | "languages" | "status" = "languages";
let savedMessage = "";

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
    <section class="settings-page">
      <aside>
        <div class="brand">
          <h1>NanoTranslator</h1>
          <p>On-device translation settings</p>
        </div>
        <nav aria-label="Settings sections">
          ${tabButton("languages", "Language")}
          ${tabButton("general", "General")}
          ${tabButton("status", "API status")}
        </nav>
      </aside>

      <section class="content">
        <header>
          <div>
            <h2>${pageTitle()}</h2>
            <p>${pageDescription()}</p>
          </div>
          <label class="switch" aria-label="Enable extension">
            <input id="enabled" type="checkbox" ${settings.enabled ? "checked" : ""} />
            <span></span>
          </label>
        </header>

        ${renderAiWarning()}
        ${savedMessage ? `<p class="saved">${savedMessage}</p>` : ""}

        <section class="panel">
          ${renderActiveTab()}
        </section>
      </section>
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
      <strong>AI unavailable in this browser</strong>
      <p>${aiUnavailableMessage()}</p>
    </section>
  `;
}

function tabButton(tab: typeof activeTab, label: string): string {
  return `<button type="button" data-tab="${tab}" class="${activeTab === tab ? "active" : ""}">${label}</button>`;
}

function pageTitle(): string {
  if (activeTab === "general") {
    return "General settings";
  }
  if (activeTab === "status") {
    return "Built-in AI status";
  }
  return "Language settings";
}

function pageDescription(): string {
  if (activeTab === "general") {
    return "Control how text selection and Shift behave on web pages.";
  }
  if (activeTab === "status") {
    return "Check whether Chrome's on-device AI APIs are available on this browser.";
  }
  return "Choose the language currently used on pages and the target translation language.";
}

function renderActiveTab(): string {
  if (activeTab === "general") {
    return renderGeneralSettings();
  }

  if (activeTab === "status") {
    return renderStatusSettings();
  }

  return renderLanguageSettings();
}

function renderLanguageSettings(): string {
  return `
    <div class="field-group">
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
    </div>

    <p class="note">Khi bôi đen và bấm Shift, NanoTranslator dịch từ ngôn ngữ đang dùng sang ngôn ngữ đích.</p>
  `;
}

function renderGeneralSettings(): string {
  return `
    <div class="field-group">
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
          ${textToneOptions.map((tone) => `<option value="${tone.value}" ${settings.textTone === tone.value ? "selected" : ""}>${tone.label} - ${tone.description}</option>`).join("")}
        </select>
      </label>
    </div>

    <p class="note">Default behavior follows Ddict: select text and press Shift to translate in place. Ngữ điệu áp dụng cho Write, Rewrite và Prompt; Chrome Translator API không hỗ trợ chỉnh tone trực tiếp.</p>
  `;
}

function renderStatusSettings(): string {
  return `
    <div class="status-title">
      <h3>API availability</h3>
      <button id="refresh" type="button">Refresh</button>
    </div>
    ${renderStatuses()}
  `;
}

function renderStatuses(): string {
  if (!statuses) {
    return `<p class="note">Checking APIs...</p>`;
  }

  return `
    <div class="status-list">
      ${Object.entries(statuses)
        .map(([name, status]) => `<div class="status-row"><span>${name}</span><strong data-status="${status}">${status}</strong></div>`)
        .join("")}
    </div>
  `;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab as typeof activeTab;
      savedMessage = "";
      render();
    });
  });

  document.querySelector<HTMLInputElement>("#enabled")?.addEventListener("change", async (event) => {
    settings.enabled = (event.currentTarget as HTMLInputElement).checked;
    await persistSettings();
  });

  document.querySelector<HTMLSelectElement>("#targetLanguage")?.addEventListener("change", async (event) => {
    settings.targetLanguage = (event.currentTarget as HTMLSelectElement).value;
    await persistSettings();
    void refreshStatus();
  });

  document.querySelector<HTMLSelectElement>("#sourceLanguage")?.addEventListener("change", async (event) => {
    settings.sourceLanguage = (event.currentTarget as HTMLSelectElement).value;
    await persistSettings();
    void refreshStatus();
  });

  document.querySelector<HTMLSelectElement>("#sourceLanguageMode")?.addEventListener("change", async (event) => {
    settings.sourceLanguageMode = (event.currentTarget as HTMLSelectElement).value as ExtensionSettings["sourceLanguageMode"];
    await persistSettings();
    void refreshStatus();
  });

  document.querySelector<HTMLSelectElement>("#shiftAction")?.addEventListener("change", async (event) => {
    settings.shiftAction = (event.currentTarget as HTMLSelectElement).value as ExtensionSettings["shiftAction"];
    await persistSettings();
  });

  document.querySelector<HTMLInputElement>("#characterLimit")?.addEventListener("change", async (event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    settings.characterLimit = Math.max(50, Math.min(5000, value || 500));
    await persistSettings();
  });

  document.querySelector<HTMLSelectElement>("#textTone")?.addEventListener("change", async (event) => {
    settings.textTone = (event.currentTarget as HTMLSelectElement).value as ExtensionSettings["textTone"];
    await persistSettings();
  });

  document.querySelector<HTMLButtonElement>("#refresh")?.addEventListener("click", () => {
    statuses = null;
    render();
    void refreshStatus();
  });
}

async function persistSettings(): Promise<void> {
  await saveSettings(settings);
  savedMessage = "Settings saved.";
  render();
}
