import type { AnalysisSource, ActionStatus } from '@/lib/types';

export function SourceBadge({ source }: { source: AnalysisSource }) {
  return source === 'ai' ? (
    <span className="badge badge-ai" title="Structured output from the AI model (Groq), validated before use">
      AI
    </span>
  ) : (
    <span
      className="badge badge-rules"
      title="Built by the rule-based extractor: no AI key, or the AI call failed or returned invalid output"
    >
      Rule-based
    </span>
  );
}

export function StatusBadge({ status }: { status: ActionStatus }) {
  return <span className={`badge badge-${status}`}>{status === 'open' ? 'Open' : 'Done'}</span>;
}
