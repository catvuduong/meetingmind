'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { MeetingContent } from '@/components/meeting-content';
import { SourceBadge } from '@/components/badges';
import { EmptyState, ErrorState, ResultSkeleton } from '@/components/states';
import { ApiError, api } from '@/lib/api';
import { withActionItem } from '@/lib/format';
import { MAX_TRANSCRIPT_LENGTH, SAMPLE_MEETING } from '@/lib/sample';
import type { ActionItem, Meeting } from '@/lib/types';

type Phase = 'idle' | 'loading' | 'done' | 'error';

export default function AnalysePage() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api
      .capabilities()
      .then((capabilities) => {
        if (active) setAiEnabled(capabilities.ai);
      })
      .catch(() => {
        if (active) setAiEnabled(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const overLimit = transcript.length > MAX_TRANSCRIPT_LENGTH;
  const blank = transcript.trim().length === 0;

  async function analyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blank || overLimit || phase === 'loading') return;
    setPhase('loading');
    setError(null);
    try {
      const result = await api.analyse({
        title: title.trim() || undefined,
        date: date || undefined,
        transcript: transcript.trim(),
      });
      setMeeting(result);
      setPhase('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The meeting could not be analysed. Please try again.');
      setPhase('error');
    }
  }

  function loadSample() {
    setTitle(SAMPLE_MEETING.title);
    setTranscript(SAMPLE_MEETING.transcript);
    setPhase('idle');
    setMeeting(null);
    setError(null);
  }

  function clearForm() {
    setTitle('');
    setDate('');
    setTranscript('');
    setPhase('idle');
    setMeeting(null);
    setError(null);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Analyse a meeting</h1>
          <p className="page-subtitle">
            Paste a transcript to get a summary, the decisions made and a tracked list of action items.
          </p>
        </div>
      </header>

      <aside className="notice" role="note">
        <strong className="notice-title">Privacy</strong>
        <p>
          Use fictional or anonymised text only. Do not paste real client names, passwords or confidential content.
          Analysed meetings are saved to the app’s database and are visible to anyone who can open this app.
        </p>
      </aside>

      <div className="analyse-grid">
        <section className="card" aria-labelledby="input-heading">
          <div className="card-header">
            <h2 id="input-heading" className="card-title">
              Transcript
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadSample}>
              Load sample
            </button>
          </div>

          <form className="card-body form-stack" onSubmit={analyse}>
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="meeting-title">
                  Meeting title <span className="optional">(optional)</span>
                </label>
                <input
                  id="meeting-title"
                  className="input"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Sprint planning"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="meeting-date">
                  Meeting date <span className="optional">(blank = today)</span>
                </label>
                <input
                  id="meeting-date"
                  className="input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <div className="field-header">
                <label className="field-label" htmlFor="transcript">
                  Transcript
                </label>
                <span
                  id="transcript-count"
                  className={overLimit ? 'counter is-over' : 'counter'}
                  aria-live="polite"
                >
                  {transcript.length.toLocaleString('en-US')} / {MAX_TRANSCRIPT_LENGTH.toLocaleString('en-US')}
                </span>
              </div>
              <textarea
                id="transcript"
                className="textarea"
                rows={14}
                placeholder={'Speaker: what was said.\nAnother speaker: a decision, or “I’ll send the notes by Friday.”'}
                value={transcript}
                aria-describedby="transcript-help transcript-count"
                aria-invalid={overLimit}
                onChange={(e) => setTranscript(e.target.value)}
              />
              <p id="transcript-help" className="field-hint">
                {overLimit
                  ? `Shorten the transcript to ${MAX_TRANSCRIPT_LENGTH.toLocaleString('en-US')} characters or fewer.`
                  : 'One line per speaker works best (“Name: text”). Up to 8,000 characters.'}
              </p>
            </div>

            <p className="field-hint ai-hint">
              {aiEnabled === true
                ? 'AI analysis is on. Results fall back to rule-based extraction if the model is slow or unavailable.'
                : aiEnabled === false
                  ? 'No AI key is configured, so the rule-based extractor is used. Set GROQ_API_KEY on the API to enable AI.'
                  : 'Checking analysis mode…'}
            </p>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={blank || overLimit || phase === 'loading'}>
                {phase === 'loading' ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Analysing…
                  </>
                ) : (
                  'Analyse meeting'
                )}
              </button>
              <button type="button" className="btn btn-secondary" onClick={clearForm}>
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="card" aria-labelledby="result-heading" aria-live="polite">
          <div className="card-header">
            <h2 id="result-heading" className="card-title">
              Result
            </h2>
            {phase === 'done' && meeting && <SourceBadge source={meeting.source} />}
          </div>
          <div className="card-body">
            {phase === 'idle' && (
              <EmptyState title="No analysis yet">
                Paste a transcript or load the sample, then choose “Analyse meeting”. The summary, decisions and action
                items will appear here.
              </EmptyState>
            )}
            {phase === 'loading' && <ResultSkeleton />}
            {phase === 'error' && error && <ErrorState message={error} />}
            {phase === 'done' && meeting && (
              <div className="content-stack">
                <div className="result-header">
                  <div>
                    <h3 className="result-title">{meeting.title}</h3>
                    <p className="muted">
                      Saved as meeting #{meeting.id} on {meeting.date}
                    </p>
                  </div>
                  <Link className="btn btn-secondary btn-sm" href={`/meetings/${meeting.id}`}>
                    Open saved meeting
                  </Link>
                </div>
                <MeetingContent
                  meeting={meeting}
                  onItemChange={(item: ActionItem) => setMeeting((current) => current && withActionItem(current, item))}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
