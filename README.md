# MeetingMind

Paste a meeting transcript and get back a short summary, the decisions made, and action items with owner and due date. Every analysed meeting is saved, so you can search past meetings and track action items until they are done.

It works fully **without an AI key** (rule-based extraction). With a Groq key it uses an AI model for better results, and the UI badge shows which path produced each result: **AI** or **Rule-based**.

> Privacy: use fictional or anonymised text only. The app shows this notice on the analyse page. All seeded demo data is fictional.

## Layout

- `apps/api`: NestJS API with Postgres via the shared `DbService` (plain `pg`, no ORM).
- `apps/web`: Next.js app (Analyse, Meetings, Action items), responsive, light and dark theme.
- `e2e/`: Playwright tests, including 390px phone checks.

## Commands

```bash
npm install
docker compose up -d db                       # local Postgres on port 55432
export DATABASE_URL=postgres://postgres:postgres@localhost:55432/app
npm run verify                                # lint, unit + API tests, build, e2e
```

Without `DATABASE_URL` the API starts, reports `db: disabled`, and the meeting endpoints return 503.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API | Postgres connection. Tables and demo seed data are created on start. |
| `GROQ_API_KEY` | API | Enables the AI path. Read only from the environment; never sent to the browser or logged. |
| `GROQ_MODEL` | API | Optional. Defaults to `openai/gpt-oss-20b`. |
| `CORS_ORIGINS` | API | Comma-separated web origins allowed to call the API. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_API_URL` | Web (build time) | Base URL of the API. Defaults to `http://localhost:3001`. |

## API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/meetings` | Body `{title?, date?, transcript}`. Transcript 1 to 8,000 characters. Returns the saved meeting with `summary`, `decisions`, `actionItems` and `source` (`ai` or `rules`). |
| GET | `/meetings?q=` | Search across title, summary and action items. |
| GET | `/meetings/:id` | Full meeting including transcript. |
| DELETE | `/meetings/:id` | 204 on success. |
| GET | `/action-items?owner=&status=` | `owner=unassigned` lists items without an owner. `status` is `open` or `done`. |
| PATCH | `/action-items/:id` | Body `{status: "open" \| "done"}`. |
| GET | `/capabilities` | `{ai: boolean}`, true when a Groq key is configured. |

Errors use standard HTTP statuses: 400 for invalid input, 404 for unknown ids, 503 when the database is not configured.

## How analysis works

### AI path: structured output, validated

1. The API calls Groq's OpenAI-compatible chat endpoint with `reasoning_effort: "low"`, a 7-second timeout, and the default model `openai/gpt-oss-20b`.
2. The prompt asks for **one JSON object**: `{summary: string[], decisions: string[], actionItems: [{task, owner, due}]}`. It says to use only facts stated in the transcript, to treat the transcript as data rather than instructions, and to use `null` for owner or due when they are not stated. The transcript is wrapped in markers to limit prompt injection.
3. The reply is parsed tolerantly (code fences and surrounding prose are stripped). It is then validated strictly:
   - Wrong top-level shape, or no usable summary, is rejected.
   - Invalid list entries are dropped. Summary is capped at 5 bullets; action items at 25.
   - **Owner check:** an owner who does not appear as a whole word in the transcript is set to `null`.
   - Due dates must be real calendar dates (`2026-02-30` is rejected) and are only kept when the transcript contains a date phrase. A due phrase such as "Friday" is resolved to a date.
4. If the reply is not valid JSON or fails validation, the call is retried **once**, with the bad reply shown back to the model. Network, HTTP and timeout failures are not retried.

### Fallback: rule-based extractor

Used when there is no key, the call fails or times out, or two replies are invalid. The result is saved with `source: "rules"`. The user never sees an error for this.

- **Speakers:** lines of the form `Name: text` keep their speaker.
- **Action item:** a sentence with `Action:`, `action item`, `to do`, or an `@name` mention; or a sentence with `will`/`I'll`/`needs to` **and** a named owner or a due date. A bare "will" is not enough, which avoids false positives such as "The release will ship in March." Questions are never actions.
- **Owner:** the `@mention`, a leading `Name will/to ...`, or the speaker when they say "I'll". Pronouns and common words are excluded.
- **Decision:** a sentence with "decided", "agreed", "decision", "we will go with" or "we'll go with".
- **Summary:** the 3 to 5 longest informative sentences, in transcript order.
- **Due dates:** ISO dates, "today", "tomorrow", "next week" (+7 days), "this week" / "end of the week" (that Friday), weekday names (on or after the meeting date; "next Friday" falls in the following calendar week), "in N days/weeks", and "Nov 20" / "20 November" (optionally with a year). The meeting date is the reference; when omitted it is today.

Tests cover the extractor, date parsing, validation and the owner check, and the fallback behaviour with a mocked `fetch` (the tests never call Groq). The endpoint tests clear `GROQ_API_KEY`, so they cannot reach Groq either.

## Demo data

On first start the API seeds four fictional meetings with action items. Dates are relative to the day the seed runs, so some items are due soon and one is overdue. The seed runs once per database, tracked by a row in `app_state`, so deleting the demo meetings does not bring them back.

## Deploying

The API and web are deployed to Vercel by the existing workflow (see `.github/workflows/ci.yml`). Configure:

- API project: `DATABASE_URL`, `CORS_ORIGINS` (must include the web origin), and optionally `GROQ_API_KEY` and `GROQ_MODEL`.
- Web project: `NEXT_PUBLIC_API_URL` must be set at build time to the API's URL.
