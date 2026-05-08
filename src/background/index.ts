import type { RuntimeMessage, RuntimeResponse, SelectedTextPayload } from "../shared/contracts";

const SESSION_SELECTION_KEY = "nanotranslator.currentSelection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data } satisfies RuntimeResponse))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      } satisfies RuntimeResponse);
    });

  return true;
});

async function handleMessage(message: RuntimeMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "OPEN_TOOL":
      await persistSelection(message.payload);
      await openSidePanel(sender.tab?.id);
      return message.payload;

    case "GET_SELECTION":
      return getPersistedSelection();

    case "SELECTION_UPDATED":
      await persistSelection(message.payload);
      return message.payload;

    case "GET_API_STATUS":
      throw new Error("API status must be checked from an extension page, not the service worker.");

    default:
      return undefined;
  }
}

async function persistSelection(payload: SelectedTextPayload): Promise<void> {
  await chrome.storage.session.set({ [SESSION_SELECTION_KEY]: payload });
}

async function getPersistedSelection(): Promise<SelectedTextPayload | null> {
  const result = await chrome.storage.session.get(SESSION_SELECTION_KEY);
  return result[SESSION_SELECTION_KEY] ?? null;
}

async function openSidePanel(tabId?: number): Promise<void> {
  if (!tabId) {
    return;
  }

  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: true
  });

  await chrome.sidePanel.open({ tabId });
}
