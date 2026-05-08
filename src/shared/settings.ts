import type { ExtensionSettings } from "./contracts";

export const defaultSettings: ExtensionSettings = {
  enabled: true,
  targetLanguage: "vi",
  sourceLanguage: "en",
  sourceLanguageMode: "manual",
  shiftAction: "directTranslate",
  textTone: "neutral",
  characterLimit: 500
};

const SETTINGS_KEY = "nanotranslator.settings";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...defaultSettings, ...(result[SETTINGS_KEY] ?? {}) };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: ExtensionSettings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "sync" || !changes[SETTINGS_KEY]?.newValue) {
      return;
    }
    callback({ ...defaultSettings, ...changes[SETTINGS_KEY].newValue });
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
