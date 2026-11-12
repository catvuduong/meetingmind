import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { analyseMeeting } from '../analysis/analyse.js';
import { todayIso } from '../analysis/dates.js';
import { DbService, type Query } from '../db.service.js';
import { DEMO_SEED_KEY, buildSeedMeetings } from './seed.js';
import type { NewMeetingInput } from './meeting-input.js';
import type {
  ActionItem,
  ActionStatus,
  BoardActionItem,
  Meeting,
  MeetingRecord,
  MeetingSummary,
} from './types.js';
import type { AnalysisSource } from '../analysis/types.js';

interface MeetingRow {
  id: number;
  title: string;
  date: string;
  transcript: string;
  summary: string[];
  decisions: string[];
  source: AnalysisSource;
  createdAt: Date;
}

interface SummaryRow {
  id: number;
  title: string;
  date: string;
  source: AnalysisSource;
  summary: string[];
  openCount: number;
  totalCount: number;
}

interface ItemRow {
  id: number;
  meetingId: number;
  task: string;
  owner: string | null;
  due: string | null;
  status: ActionStatus;
  meetingTitle?: string;
  meetingDate?: string;
}

const ITEM_COLUMNS = `a.id, a.meeting_id AS "meetingId", a.task, a.owner,
  to_char(a.due_date, 'YYYY-MM-DD') AS due, a.status`;

function toActionItem(row: ItemRow): ActionItem {
  return { id: row.id, meetingId: row.meetingId, task: row.task, owner: row.owner, due: row.due, status: row.status };
}

function toBoardItem(row: ItemRow): BoardActionItem {
  return {
    ...toActionItem(row),
    meetingTitle: row.meetingTitle ?? '',
    meetingDate: row.meetingDate ?? '',
  };
}

async function loadMeeting(query: Query, id: number): Promise<Meeting | null> {
  const [row] = await query<MeetingRow>(
    `SELECT m.id, m.title, to_char(m.meeting_date, 'YYYY-MM-DD') AS date, m.transcript,
            m.summary, m.decisions, m.source, m.created_at AS "createdAt"
       FROM meetings m WHERE m.id = $1`,
    [id],
  );
  if (!row) return null;
  const items = await query<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM action_items a WHERE a.meeting_id = $1 ORDER BY a.position, a.id`,
    [id],
  );
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    transcript: row.transcript,
    summary: row.summary,
    decisions: row.decisions,
    source: row.source,
    createdAt: new Date(row.createdAt).toISOString(),
    actionItems: items.map(toActionItem),
  };
}

async function insertMeeting(query: Query, record: MeetingRecord): Promise<number> {
  const [inserted] = await query<{ id: number }>(
    `INSERT INTO meetings (title, meeting_date, transcript, summary, decisions, source)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      record.title,
      record.date,
      record.transcript,
      JSON.stringify(record.summary),
      JSON.stringify(record.decisions),
      record.source,
    ],
  );
  for (const [position, item] of record.actionItems.entries()) {
    await query(
      `INSERT INTO action_items (meeting_id, position, task, owner, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [inserted.id, position, item.task, item.owner, item.due, item.status ?? 'open'],
    );
  }
  return inserted.id;
}

@Injectable()
export class MeetingsService implements OnModuleInit {
  private readonly logger = new Logger('MeetingsService');

  constructor(private readonly db: DbService) {}

  /** True when a Groq key is configured. Read per call so the value always reflects the environment. */
  get aiEnabled(): boolean {
    return Boolean(process.env.GROQ_API_KEY?.trim());
  }

  async onModuleInit(): Promise<void> {
    if (!this.db.enabled) return;
    try {
      // Seeds run once per database: the marker row and the demo meetings commit together.
      await this.db.transaction(async (query) => {
        const marker = await query(
          'INSERT INTO app_state (key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING key',
          [DEMO_SEED_KEY],
        );
        if (marker.length === 0) return;
        for (const record of buildSeedMeetings(todayIso())) await insertMeeting(query, record);
      });
    } catch (err) {
      this.logger.warn(`Demo data not seeded: ${(err as Error).message}`);
    }
  }

  async createMeeting(input: NewMeetingInput): Promise<Meeting> {
    this.requireDb();
    const outcome = await analyseMeeting(
      { transcript: input.transcript, meetingDate: input.date },
      {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL?.trim() || undefined,
      },
    );
    if (outcome.fallbackReason && outcome.fallbackReason !== 'no-api-key') {
      this.logger.warn(`AI analysis unavailable (${outcome.fallbackReason}); used rule-based extraction`);
    }

    const id = await this.db.transaction((query) =>
      insertMeeting(query, {
        title: input.title,
        date: input.date,
        transcript: input.transcript,
        summary: outcome.summary,
        decisions: outcome.decisions,
        source: outcome.source,
        actionItems: outcome.actionItems.map((item) => ({ ...item, status: 'open' })),
      }),
    );
    return this.getMeeting(id);
  }

  async listMeetings(search: string | null): Promise<MeetingSummary[]> {
    this.requireDb();
    const pattern = search ? `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const rows = await this.db.query<SummaryRow>(
      `SELECT m.id, m.title, to_char(m.meeting_date, 'YYYY-MM-DD') AS date, m.source, m.summary,
              (SELECT count(*)::int FROM action_items a WHERE a.meeting_id = m.id AND a.status = 'open') AS "openCount",
              (SELECT count(*)::int FROM action_items a WHERE a.meeting_id = m.id) AS "totalCount"
         FROM meetings m
        WHERE $1::text IS NULL
           OR m.title ILIKE $1
           OR m.summary::text ILIKE $1
           OR EXISTS (SELECT 1 FROM action_items a
                       WHERE a.meeting_id = m.id AND (a.task ILIKE $1 OR a.owner ILIKE $1))
        ORDER BY m.meeting_date DESC, m.id DESC
        LIMIT 200`,
      [pattern],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      source: row.source,
      summary: row.summary,
      openCount: row.openCount,
      totalCount: row.totalCount,
    }));
  }

  async getMeeting(id: number): Promise<Meeting> {
    this.requireDb();
    const meeting = await this.db.transaction((query) => loadMeeting(query, id));
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async deleteMeeting(id: number): Promise<void> {
    this.requireDb();
    const rows = await this.db.query<{ id: number }>('DELETE FROM meetings WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException('Meeting not found');
  }

  async listActionItems(filter: { owner?: string; status?: ActionStatus }): Promise<BoardActionItem[]> {
    this.requireDb();
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`a.status = $${params.length}`);
    }
    if (filter.owner?.toLowerCase() === 'unassigned') {
      where.push('a.owner IS NULL');
    } else if (filter.owner) {
      params.push(filter.owner);
      where.push(`lower(a.owner) = lower($${params.length})`);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.db.query<ItemRow>(
      `SELECT ${ITEM_COLUMNS}, m.title AS "meetingTitle",
              to_char(m.meeting_date, 'YYYY-MM-DD') AS "meetingDate"
         FROM action_items a JOIN meetings m ON m.id = a.meeting_id
         ${clause}
        ORDER BY (a.status = 'open') DESC, a.due_date NULLS LAST, a.id`,
      params,
    );
    return rows.map(toBoardItem);
  }

  async updateActionItem(id: number, status: ActionStatus): Promise<BoardActionItem> {
    this.requireDb();
    const [row] = await this.db.query<ItemRow>(
      `WITH updated AS (
         UPDATE action_items SET status = $2, updated_at = now() WHERE id = $1 RETURNING *
       )
       SELECT u.id, u.meeting_id AS "meetingId", u.task, u.owner,
              to_char(u.due_date, 'YYYY-MM-DD') AS due, u.status,
              m.title AS "meetingTitle", to_char(m.meeting_date, 'YYYY-MM-DD') AS "meetingDate"
         FROM updated u JOIN meetings m ON m.id = u.meeting_id`,
      [id, status],
    );
    if (!row) throw new NotFoundException('Action item not found');
    return toBoardItem(row);
  }

  private requireDb(): void {
    if (!this.db.enabled) throw new ServiceUnavailableException('Database is not configured (DATABASE_URL is not set)');
  }
}
