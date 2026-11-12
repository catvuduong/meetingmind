import { buildMessages } from './prompt.js';
import { AI_TIMEOUT_MS, AiCallError, DEFAULT_GROQ_MODEL, requestCompletion } from './groq.js';
import { analyseWithRules } from './rule-based.js';
import { parseModelJson, validateAnalysis } from './validate.js';
import type { AnalysisSource, Analysis } from './types.js';

export interface AnalysisInput {
  transcript: string;
  /** YYYY-MM-DD; relative due phrases ("Friday", "next week") resolve against it. */
  meetingDate: string;
}

export interface AnalysisOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface AnalysisOutcome extends Analysis {
  source: AnalysisSource;
  /** Why the rule-based path was used, when it was not the AI path. */
  fallbackReason?: string;
}

const MAX_ATTEMPTS = 2;

/**
 * Tries the AI path (Groq) and falls back to the rule-based extractor on a missing key, a failed or
 * slow call, or two invalid replies. It never throws.
 */
export async function analyseMeeting(input: AnalysisInput, options: AnalysisOptions = {}): Promise<AnalysisOutcome> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    return { ...analyseWithRules(input.transcript, input.meetingDate), source: 'rules', fallbackReason: 'no-api-key' };
  }

  let reason = 'invalid-json';
  let previousReply: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let content: string;
    try {
      content = await requestCompletion({
        apiKey,
        model: options.model ?? DEFAULT_GROQ_MODEL,
        messages: buildMessages(input.transcript, input.meetingDate, previousReply),
        fetchImpl: options.fetchImpl ?? fetch,
        timeoutMs: options.timeoutMs ?? AI_TIMEOUT_MS,
      });
    } catch (err) {
      // Network, HTTP and timeout failures are not retried: the time budget is small.
      reason = err instanceof AiCallError ? err.reason : 'error';
      break;
    }

    const parsed = parseModelJson(content);
    const valid = parsed === undefined ? null : validateAnalysis(parsed, input.transcript, input.meetingDate);
    if (valid) return { ...valid, source: 'ai' };
    previousReply = content;
  }

  return { ...analyseWithRules(input.transcript, input.meetingDate), source: 'rules', fallbackReason: reason };
}
