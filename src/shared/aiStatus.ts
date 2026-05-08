import type { ApiStatusSnapshot, Availability, NanoTool } from "./contracts";

const usableStatuses = new Set<Availability>(["available", "downloadable", "downloading"]);

export const toolApiKey: Record<NanoTool, keyof ApiStatusSnapshot> = {
  translate: "translator",
  summarize: "summarizer",
  writer: "writer",
  rewriter: "rewriter",
  proofreader: "proofreader",
  prompt: "prompt"
};

export function isAvailabilityUsable(status: Availability | undefined): boolean {
  return Boolean(status && usableStatuses.has(status));
}

export function isToolUsable(tool: NanoTool, statuses: ApiStatusSnapshot | null): boolean {
  if (!statuses) {
    return true;
  }

  return isAvailabilityUsable(statuses[toolApiKey[tool]]);
}

export function hasUsableAiApi(statuses: ApiStatusSnapshot | null): boolean {
  if (!statuses) {
    return true;
  }

  return Object.values(statuses).some((status) => usableStatuses.has(status));
}

export function aiUnavailableMessage(): string {
  return "Chrome Built-in AI is not available in this browser. Use Chrome desktop 138+, enable the required Built-in AI flags, then restart Chrome. Some APIs may also require a model download or origin trial.";
}

export function toolUnavailableReason(tool: NanoTool, statuses: ApiStatusSnapshot | null): string {
  const status = statuses?.[toolApiKey[tool]];
  if (!status || status === "unknown") {
    return "Status unknown. Try refreshing the API status.";
  }
  if (status === "unsupported") {
    return "This API is not supported in your current Chrome build.";
  }
  if (status === "unavailable") {
    return "This API is unavailable. Check the required flag and restart Chrome.";
  }
  return "";
}
