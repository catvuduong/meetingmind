import { isRecord } from './text.js';
import type { ChatMessage } from './prompt.js';

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
/** Hard per-call limit; the product requirement is "under 8 seconds". */
export const AI_TIMEOUT_MS = 7000;

/** Carries a short machine-readable reason (never the key or the response body). */
export class AiCallError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export interface CompletionRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

function extractContent(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data.choices) || !isRecord(data.choices[0])) return undefined;
  const message = data.choices[0].message;
  if (!isRecord(message) || typeof message.content !== 'string') return undefined;
  // Reasoning models also return a `reasoning` field; it is deliberately ignored.
  return message.content;
}

/** One chat-completion call to Groq's OpenAI-compatible endpoint. Throws AiCallError on any failure. */
export async function requestCompletion(request: CompletionRequest): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await request.fetchImpl(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        reasoning_effort: 'low',
        messages: request.messages,
        max_completion_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AiCallError(`http-${response.status}`);
    const content = extractContent((await response.json()) as unknown);
    if (content === undefined) throw new AiCallError('bad-response');
    return content;
  } catch (err) {
    if (err instanceof AiCallError) throw err;
    throw new AiCallError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}
