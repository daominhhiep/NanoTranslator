import type { AiTaskResult, ApiStatusSnapshot, Availability, ExtensionSettings } from "./contracts";
import { normalizeAvailability } from "./languages";

type ProgressHandler = (progress: number) => void;

type ChromeAiGlobal = typeof globalThis & {
  Translator?: BuiltInAiFactory;
  Summarizer?: BuiltInAiFactory;
  Writer?: BuiltInAiFactory;
  Rewriter?: BuiltInAiFactory;
  Proofreader?: BuiltInAiFactory;
  LanguageModel?: BuiltInAiFactory & { params?: () => Promise<unknown> };
  LanguageDetector?: BuiltInAiFactory;
};

interface BuiltInAiFactory {
  availability: (options?: Record<string, unknown>) => Promise<unknown>;
  create: (options?: Record<string, unknown>) => Promise<any>;
}

export interface SummarizeOptions {
  type: "key-points" | "tldr" | "teaser" | "headline";
  length: "short" | "medium" | "long";
  format: "markdown" | "plain-text";
}

export interface WriterOptions {
  tone: "formal" | "neutral" | "casual";
  length: "short" | "medium" | "long";
  format: "markdown" | "plain-text";
  context: string;
}

export interface RewriterOptions {
  tone: "more-formal" | "as-is" | "more-casual";
  length: "shorter" | "as-is" | "longer";
  format: "as-is" | "markdown" | "plain-text";
  context: string;
}

const ai = globalThis as ChromeAiGlobal;

export async function getApiStatus(settings: ExtensionSettings): Promise<ApiStatusSnapshot> {
  const sourceLanguage = settings.sourceLanguageMode === "manual" ? settings.sourceLanguage : "en";

  const [translator, summarizer, writer, rewriter, proofreader, prompt] = await Promise.all([
    availabilityFor("Translator", { sourceLanguage, targetLanguage: settings.targetLanguage }),
    availabilityFor("Summarizer"),
    availabilityFor("Writer"),
    availabilityFor("Rewriter"),
    availabilityFor("Proofreader", { expectedInputLanguages: [sourceLanguage] }),
    availabilityFor("LanguageModel", promptSessionOptions(false))
  ]);

  return { translator, summarizer, writer, rewriter, proofreader, prompt };
}

export async function runTranslate(text: string, settings: ExtensionSettings, onProgress?: ProgressHandler): Promise<AiTaskResult> {
  const sourceLanguage = await resolveSourceLanguage(text, settings);
  const targetLanguage = settings.targetLanguage;

  if (!ai.Translator) {
    return unavailable("Translator API is not supported in this browser.");
  }

  const available = await availabilityFor("Translator", { sourceLanguage, targetLanguage });
  if (available === "unavailable" || available === "unsupported") {
    return unavailable(`Translation is unavailable for ${sourceLanguage} -> ${targetLanguage}.`);
  }

  try {
    const translator = await ai.Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor: monitorProgress(onProgress)
    });
    const output = await translator.translate(text);
    translator.destroy?.();
    return success(output);
  } catch (error) {
    return failure(error);
  }
}

export async function runSummarize(text: string, options: SummarizeOptions, onProgress?: ProgressHandler): Promise<AiTaskResult> {
  if (!ai.Summarizer) {
    return unavailable("Summarizer API is not supported in this browser.");
  }

  const available = await availabilityFor("Summarizer");
  if (available === "unavailable" || available === "unsupported") {
    return unavailable("Summarizer is unavailable on this device or Chrome version.");
  }

  try {
    const summarizer = await ai.Summarizer.create({ ...options, monitor: monitorProgress(onProgress) });
    const output = typeof summarizer.summarizeStreaming === "function"
      ? await collectStream(summarizer.summarizeStreaming(text))
      : await summarizer.summarize(text);
    summarizer.destroy?.();
    return success(output);
  } catch (error) {
    return failure(error);
  }
}

export async function runWriter(prompt: string, options: WriterOptions, onProgress?: ProgressHandler): Promise<AiTaskResult> {
  if (!ai.Writer) {
    return unavailable("Writer API is not enabled in this browser. It may require Chrome flags or an origin trial.");
  }

  const available = await availabilityFor("Writer");
  if (available === "unavailable" || available === "unsupported") {
    return unavailable("Writer is unavailable on this device or Chrome version.");
  }

  try {
    const writer = await ai.Writer.create({
      tone: options.tone,
      length: options.length,
      format: options.format,
      monitor: monitorProgress(onProgress)
    });
    const output = typeof writer.writeStreaming === "function"
      ? await collectStream(writer.writeStreaming(prompt, optionalContext(options.context)))
      : await writer.write(prompt, optionalContext(options.context));
    writer.destroy?.();
    return success(output);
  } catch (error) {
    return failure(error);
  }
}

export async function runRewriter(text: string, options: RewriterOptions, onProgress?: ProgressHandler): Promise<AiTaskResult> {
  if (!ai.Rewriter) {
    return unavailable("Rewriter API is not enabled in this browser. It may require Chrome flags or an origin trial.");
  }

  const available = await availabilityFor("Rewriter");
  if (available === "unavailable" || available === "unsupported") {
    return unavailable("Rewriter is unavailable on this device or Chrome version.");
  }

  try {
    const rewriter = await ai.Rewriter.create({
      tone: options.tone,
      length: options.length,
      format: options.format,
      monitor: monitorProgress(onProgress)
    });
    const output = await rewriter.rewrite(text, optionalContext(options.context));
    rewriter.destroy?.();
    return success(output);
  } catch (error) {
    return failure(error);
  }
}

export async function runProofreader(text: string, inputLanguage: string, onProgress?: ProgressHandler): Promise<AiTaskResult> {
  if (!ai.Proofreader) {
    return unavailable("Proofreader API is not enabled in this browser. It may require Chrome flags or an origin trial.");
  }

  const options = { expectedInputLanguages: [inputLanguage] };
  const available = await availabilityFor("Proofreader", options);
  if (available === "unavailable" || available === "unsupported") {
    return unavailable("Proofreader is unavailable for the selected language.");
  }

  try {
    const proofreader = await ai.Proofreader.create({ ...options, monitor: monitorProgress(onProgress) });
    const result = typeof proofreader.proofread === "function" ? await proofreader.proofread(text) : await proofreader.correct(text);
    proofreader.destroy?.();
    return success(formatProofreaderResult(result));
  } catch (error) {
    return failure(error);
  }
}

export async function runPrompt(prompt: string, image?: Blob, onProgress?: ProgressHandler): Promise<AiTaskResult> {
  if (!ai.LanguageModel) {
    return unavailable("Prompt API is not supported in this browser.");
  }

  const hasImage = Boolean(image);
  const sessionOptions = promptSessionOptions(hasImage);
  const available = await availabilityFor("LanguageModel", sessionOptions);
  if (available === "unavailable" || available === "unsupported") {
    return unavailable("Prompt API is unavailable for the selected input type.");
  }

  try {
    const session = await ai.LanguageModel.create({
      ...sessionOptions,
      monitor: monitorProgress(onProgress)
    });
    const output = hasImage
      ? await session.prompt([
          {
            role: "user",
            content: [
              { type: "text", value: prompt },
              { type: "image", value: image }
            ]
          }
        ])
      : await session.prompt(prompt);
    session.destroy?.();
    return success(output);
  } catch (error) {
    return failure(error);
  }
}

async function resolveSourceLanguage(text: string, settings: ExtensionSettings): Promise<string> {
  if (settings.sourceLanguageMode === "manual" || !ai.LanguageDetector) {
    return settings.sourceLanguage;
  }

  try {
    const available = await availabilityFor("LanguageDetector");
    if (available === "unavailable" || available === "unsupported") {
      return settings.sourceLanguage;
    }

    const detector = await ai.LanguageDetector.create();
    const detections = await detector.detect(text);
    detector.destroy?.();
    const best = Array.isArray(detections) ? detections[0] : undefined;
    return best?.detectedLanguage ?? best?.language ?? settings.sourceLanguage;
  } catch {
    return settings.sourceLanguage;
  }
}

async function availabilityFor(name: keyof ChromeAiGlobal, options?: Record<string, unknown>): Promise<Availability> {
  const factory = ai[name] as BuiltInAiFactory | undefined;
  if (!factory?.availability) {
    return "unsupported";
  }

  try {
    return normalizeAvailability(await factory.availability(options));
  } catch {
    return "unknown";
  }
}

function monitorProgress(onProgress?: ProgressHandler) {
  if (!onProgress) {
    return undefined;
  }

  return (monitor: EventTarget) => {
    monitor.addEventListener("downloadprogress", (event) => {
      const progressEvent = event as ProgressEvent;
      const loaded = Number(progressEvent.loaded);
      const total = Number(progressEvent.total);
      const progress = Number.isFinite(total) && total > 0 ? loaded / total : loaded;
      onProgress(Math.max(0, Math.min(1, progress)));
    });
  };
}

async function collectStream(stream: AsyncIterable<string> | ReadableStream<string>): Promise<string> {
  let output = "";

  if (Symbol.asyncIterator in stream) {
    for await (const chunk of stream as AsyncIterable<string>) {
      output += chunk;
    }
    return output;
  }

  const reader = (stream as ReadableStream<string>).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    output += value;
  }
  return output;
}

function promptSessionOptions(includeImage: boolean): Record<string, unknown> {
  return {
    expectedInputs: includeImage
      ? [{ type: "text", languages: ["en"] }, { type: "image" }]
      : [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }]
  };
}

function optionalContext(context: string): Record<string, string> | undefined {
  const trimmed = context.trim();
  return trimmed ? { context: trimmed } : undefined;
}

function success(output: unknown): AiTaskResult {
  return { status: "success", output: String(output ?? "") };
}

function unavailable(detail: string): AiTaskResult {
  return { status: "unavailable", output: "", detail };
}

function failure(error: unknown): AiTaskResult {
  return {
    status: "error",
    output: "",
    detail: error instanceof Error ? error.message : String(error)
  };
}

function formatProofreaderResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result)) {
    return result.map((item) => JSON.stringify(item, null, 2)).join("\n\n");
  }

  return JSON.stringify(result, null, 2);
}
