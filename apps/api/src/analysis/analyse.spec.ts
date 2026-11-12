import { analyseMeeting } from './analyse.js';
import { DEFAULT_GROQ_MODEL, GROQ_CHAT_URL } from './groq.js';

const MEETING = '2026-11-12';
const TRANSCRIPT = [
  'Priya: We need the export fixed by Friday.',
  'Marco: I will look into the retry logic.',
  "Lena: I'll write the FAQ for support.",
].join('\n');
const KEY = 'test-key-not-real';

const VALID_REPLY = JSON.stringify({
  summary: ['The export fix is due Friday.', 'Marco is checking the retry logic.'],
  decisions: [],
  actionItems: [
    { task: 'Fix the export', owner: 'Priya', due: '2026-11-13' },
    { task: 'Write the FAQ for support', owner: 'Dana', due: null },
  ],
});

function completion(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content, reasoning: 'hidden' } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fetch stand-in that records every call and answers with the handler's response. */
function fakeFetch(handler: (call: number, init: RequestInit) => Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init: init ?? {} });
    return handler(calls.length - 1, init ?? {});
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const input = { transcript: TRANSCRIPT, meetingDate: MEETING };

describe('analyseMeeting: rule-based path', () => {
  it('uses the rules and never calls the network when no key is set', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => completion(VALID_REPLY));
    const outcome = await analyseMeeting(input, { apiKey: '   ', fetchImpl });
    expect(outcome.source).toBe('rules');
    expect(outcome.fallbackReason).toBe('no-api-key');
    expect(calls).toHaveLength(0);
  });

  it('falls back when the request fails with a network error', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });
    expect(outcome.source).toBe('rules');
    expect(outcome.fallbackReason).toBe('network');
    expect(calls).toHaveLength(1);
    expect(outcome.actionItems.length).toBeGreaterThan(0);
  });

  it('falls back on an HTTP error without retrying', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => new Response('server error', { status: 500 }));
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });
    expect(outcome.source).toBe('rules');
    expect(outcome.fallbackReason).toBe('http-500');
    expect(calls).toHaveLength(1);
  });

  it('falls back when the call times out', async () => {
    const { fetchImpl } = fakeFetch(
      (_call, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl, timeoutMs: 20 });
    expect(outcome.source).toBe('rules');
    expect(outcome.fallbackReason).toBe('timeout');
  });

  it('falls back when the reply has no message content', async () => {
    const { fetchImpl } = fakeFetch(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });
    expect(outcome.source).toBe('rules');
    expect(outcome.fallbackReason).toBe('bad-response');
  });

  it('falls back after two invalid JSON replies', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => completion('Sorry, here is some prose instead of JSON.'));
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });
    expect(outcome.source).toBe('rules');
    expect(outcome.fallbackReason).toBe('invalid-json');
    expect(calls).toHaveLength(2);
  });

  it('falls back when the AI reply is valid JSON but the wrong shape, twice', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => completion('{"summary": "one string"}'));
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });
    expect(outcome.source).toBe('rules');
    expect(calls).toHaveLength(2);
  });
});

describe('analyseMeeting: AI path', () => {
  it('returns the validated AI result and sends the expected request', async () => {
    const { fetchImpl, calls } = fakeFetch(async () => completion(VALID_REPLY));
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });

    expect(outcome.source).toBe('ai');
    expect(outcome.fallbackReason).toBeUndefined();
    expect(outcome.decisions).toEqual([]);
    expect(outcome.summary).toEqual(['The export fix is due Friday.', 'Marco is checking the retry logic.']);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(GROQ_CHAT_URL);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(calls[0].init.body as string) as Record<string, unknown>;
    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
    expect(body.reasoning_effort).toBe('low');
    expect(JSON.stringify(body.messages)).toContain('Use only facts');
  });

  it('nulls an owner who is not in the transcript', async () => {
    const { fetchImpl } = fakeFetch(async () => completion(VALID_REPLY));
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl });
    expect(outcome.actionItems).toEqual([
      { task: 'Fix the export', owner: 'Priya', due: '2026-11-13' },
      { task: 'Write the FAQ for support', owner: null, due: null },
    ]);
  });

  it('uses the model from options and passes the previous reply back on retry', async () => {
    const { fetchImpl, calls } = fakeFetch(async (call) =>
      completion(call === 0 ? 'not json at all' : VALID_REPLY),
    );
    const outcome = await analyseMeeting(input, { apiKey: KEY, fetchImpl, model: 'openai/gpt-oss-120b' });

    expect(outcome.source).toBe('ai');
    expect(calls).toHaveLength(2);
    const retry = JSON.parse(calls[1].init.body as string) as { model: string; messages: Array<{ role: string; content: string }> };
    expect(retry.model).toBe('openai/gpt-oss-120b');
    expect(retry.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(retry.messages[2].content).toBe('not json at all');
  });

  it('accepts a reply wrapped in a code fence', async () => {
    const { fetchImpl } = fakeFetch(async () => completion('```json\n' + VALID_REPLY + '\n```'));
    expect((await analyseMeeting(input, { apiKey: KEY, fetchImpl })).source).toBe('ai');
  });
});
