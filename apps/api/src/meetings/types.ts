import type { AnalysisSource } from '../analysis/types.js';

export type ActionStatus = 'open' | 'done';

export interface ActionItem {
  id: number;
  meetingId: number;
  task: string;
  owner: string | null;
  /** YYYY-MM-DD or null. */
  due: string | null;
  status: ActionStatus;
}

export interface BoardActionItem extends ActionItem {
  meetingTitle: string;
  meetingDate: string;
}

export interface Meeting {
  id: number;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  transcript: string;
  summary: string[];
  decisions: string[];
  actionItems: ActionItem[];
  source: AnalysisSource;
  createdAt: string;
}

export interface MeetingSummary {
  id: number;
  title: string;
  date: string;
  source: AnalysisSource;
  summary: string[];
  openCount: number;
  totalCount: number;
}

/** A fully analysed meeting ready to be stored. */
export interface MeetingRecord {
  title: string;
  date: string;
  transcript: string;
  summary: string[];
  decisions: string[];
  source: AnalysisSource;
  actionItems: Array<{ task: string; owner: string | null; due: string | null; status?: ActionStatus }>;
}
