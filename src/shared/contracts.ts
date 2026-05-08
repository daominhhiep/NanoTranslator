export type NanoTool = "translate" | "summarize" | "writer" | "rewriter" | "proofreader" | "prompt";

export type Availability = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported" | "unknown";

export type TaskStatus = "idle" | "loading" | "downloading" | "success" | "error" | "unavailable";

export type TextTone = "neutral" | "formal" | "casual" | "friendly" | "academic";

export interface ExtensionSettings {
  enabled: boolean;
  targetLanguage: string;
  sourceLanguage: string;
  sourceLanguageMode: "auto" | "manual";
  shiftAction: "menu" | "directTranslate";
  textTone: TextTone;
  characterLimit: number;
}

export interface SelectedTextPayload {
  text: string;
  tool: NanoTool;
  pageUrl: string;
  pageTitle: string;
  createdAt: number;
}

export interface AiTaskResult {
  status: TaskStatus;
  output: string;
  detail?: string;
  progress?: number;
}

export interface ApiStatusSnapshot {
  translator: Availability;
  summarizer: Availability;
  writer: Availability;
  rewriter: Availability;
  proofreader: Availability;
  prompt: Availability;
}

export type RuntimeMessage =
  | { type: "OPEN_TOOL"; payload: SelectedTextPayload }
  | { type: "GET_SELECTION" }
  | { type: "SELECTION_UPDATED"; payload: SelectedTextPayload }
  | { type: "GET_API_STATUS" };

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
