export interface ActionItemDraft {
  task: string;
  owner: string | null;
  /** Calendar date, YYYY-MM-DD, or null when the transcript does not state one. */
  due: string | null;
}

export interface Analysis {
  summary: string[];
  decisions: string[];
  actionItems: ActionItemDraft[];
}

export type AnalysisSource = 'ai' | 'rules';
