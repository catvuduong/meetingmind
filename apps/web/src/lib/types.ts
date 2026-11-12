export type AnalysisSource = 'ai' | 'rules';
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

export interface BoardItem extends ActionItem {
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

export interface Capabilities {
  ai: boolean;
}

export interface Health {
  status: string;
  db: 'up' | 'down' | 'disabled';
}
