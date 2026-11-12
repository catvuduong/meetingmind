import type { ActionItem, BoardItem, Capabilities, Health, Meeting, MeetingSummary } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

function errorMessage(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const { message } = data as { message: unknown };
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return `Request failed (HTTP ${status}).`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { method: options.method ?? 'GET', cache: 'no-store' };
  if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the MeetingMind API. Check that it is running.', 0);
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(errorMessage(data, response.status), response.status);
  return data as T;
}

export interface AnalyseInput {
  title?: string;
  date?: string;
  transcript: string;
}

export const api = {
  health: () => apiRequest<Health>('/health'),
  capabilities: () => apiRequest<Capabilities>('/capabilities'),
  analyse: (input: AnalyseInput) => apiRequest<Meeting>('/meetings', { method: 'POST', body: input }),
  listMeetings: (search: string) =>
    apiRequest<MeetingSummary[]>(`/meetings${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  getMeeting: (id: number) => apiRequest<Meeting>(`/meetings/${id}`),
  deleteMeeting: (id: number) => apiRequest<void>(`/meetings/${id}`, { method: 'DELETE' }),
  listActionItems: () => apiRequest<BoardItem[]>('/action-items'),
  setActionStatus: (id: number, status: ActionItem['status']) =>
    apiRequest<BoardItem>(`/action-items/${id}`, { method: 'PATCH', body: { status } }),
};
