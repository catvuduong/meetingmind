import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../app.module.js';
import { configureApp } from '../app.setup.js';

// These tests persist data, so they need the throwaway Postgres from `npm run verify` (DATABASE_URL).
// The AI key is cleared so no test can reach Groq; the AI path is covered by analysis/analyse.spec.ts.
describe.runIf(Boolean(process.env.DATABASE_URL))('Meetings API', () => {
  let app: INestApplication<App>;
  const token = `zq${Date.now()}`;
  const transcript = [
    `Priya: Launch review for ${token}. We decided to ship on the first Monday.`,
    'Marco: I\'ll send the release checklist by Friday.',
    'Ben: Action: Ben to update the status page before the release.',
  ].join('\n');

  beforeAll(async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:3000');
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const server = () => app.getHttpServer();

  it('reports AI as unavailable without a key', async () => {
    const res = await request(server()).get('/capabilities').expect(200);
    expect(res.body).toEqual({ ai: false });
  });

  it('reports AI as available when a key is configured, without calling the provider', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-not-real');
    try {
      const res = await request(server()).get('/capabilities').expect(200);
      expect(res.body).toEqual({ ai: true });
    } finally {
      vi.stubEnv('GROQ_API_KEY', '');
    }
  });

  it('seeds demo meetings on first start', async () => {
    const res = await request(server()).get('/meetings').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  describe('POST /meetings validation', () => {
    it.each([
      ['empty transcript', { transcript: '' }],
      ['whitespace transcript', { transcript: '   ' }],
      ['missing transcript', { title: 'No transcript' }],
      ['non-string transcript', { transcript: 12 }],
      ['transcript over 8000 characters', { transcript: 'a'.repeat(8001) }],
      ['invalid date', { transcript: 'Priya: hi.', date: '2026-02-30' }],
      ['non-string title', { transcript: 'Priya: hi.', title: ['x'] }],
    ])('rejects %s with 400', async (_name, body) => {
      await request(server()).post('/meetings').send(body).expect(400);
    });

    it('accepts exactly 8000 characters', async () => {
      const res = await request(server())
        .post('/meetings')
        .send({ transcript: `Priya: ${'a'.repeat(8000 - 7)}` })
        .expect(201);
      await request(server()).delete(`/meetings/${res.body.id}`).expect(204);
    });
  });

  describe('meeting lifecycle', () => {
    let meetingId: number;
    let openItemId: number;
    let ownerItemId: number;

    it('analyses and saves a meeting with rule-based results', async () => {
      const res = await request(server())
        .post('/meetings')
        .send({ title: `Endpoint test ${token}`, date: '2026-11-12', transcript })
        .expect(201);

      meetingId = res.body.id;
      expect(res.body.source).toBe('rules');
      expect(res.body.date).toBe('2026-11-12');
      expect(res.body.summary.length).toBeGreaterThanOrEqual(1);
      expect(res.body.decisions).toEqual([expect.stringContaining('ship on the first Monday')]);
      expect(res.body.actionItems).toHaveLength(2);
      expect(res.body.actionItems[0]).toEqual({
        id: expect.any(Number),
        meetingId,
        task: 'Send the release checklist',
        owner: 'Marco',
        due: '2026-11-13',
        status: 'open',
      });
      openItemId = res.body.actionItems[0].id;
      ownerItemId = res.body.actionItems[1].id;
    });

    it('finds the meeting by title, summary and action-item text', async () => {
      const byTitle = await request(server()).get('/meetings').query({ q: token }).expect(200);
      expect(byTitle.body.map((m: { id: number }) => m.id)).toContain(meetingId);

      const byTask = await request(server()).get('/meetings').query({ q: 'release checklist' }).expect(200);
      expect(byTask.body.map((m: { id: number }) => m.id)).toContain(meetingId);

      const bySummaryMiss = await request(server()).get('/meetings').query({ q: `nothing-${token}` }).expect(200);
      expect(bySummaryMiss.body.map((m: { id: number }) => m.id)).not.toContain(meetingId);
    });

    it('treats LIKE wildcards in the search as plain text', async () => {
      const res = await request(server()).get('/meetings').query({ q: '%' }).expect(200);
      expect(res.body.every((m: { title: string }) => typeof m.title === 'string')).toBe(true);
      const none = await request(server()).get('/meetings').query({ q: `${token}%_` }).expect(200);
      expect(none.body.map((m: { id: number }) => m.id)).not.toContain(meetingId);
    });

    it('reports open and total action-item counts in the list', async () => {
      const res = await request(server()).get('/meetings').query({ q: token }).expect(200);
      const row = res.body.find((m: { id: number }) => m.id === meetingId);
      expect(row).toMatchObject({ openCount: 2, totalCount: 2 });
    });

    it('returns the full meeting with action items', async () => {
      const res = await request(server()).get(`/meetings/${meetingId}`).expect(200);
      expect(res.body.transcript).toBe(transcript);
      expect(res.body.actionItems).toHaveLength(2);
    });

    it('returns 404 for an unknown meeting and 400 for a bad id', async () => {
      await request(server()).get('/meetings/2147483000').expect(404);
      await request(server()).get('/meetings/3000000000').expect(404);
      await request(server()).get('/meetings/abc').expect(400);
    });

    it('lists action items filtered by owner and status', async () => {
      const byOwner = await request(server()).get('/action-items').query({ owner: 'marco' }).expect(200);
      expect(byOwner.body.map((i: { id: number }) => i.id)).toContain(openItemId);
      expect(byOwner.body.every((i: { owner: string }) => i.owner.toLowerCase() === 'marco')).toBe(true);

      const unassigned = await request(server()).get('/action-items').query({ owner: 'unassigned' }).expect(200);
      expect(unassigned.body.every((i: { owner: unknown }) => i.owner === null)).toBe(true);

      await request(server()).get('/action-items').query({ status: 'archived' }).expect(400);
    });

    it('marks an action item done and back to open', async () => {
      const done = await request(server()).patch(`/action-items/${openItemId}`).send({ status: 'done' }).expect(200);
      expect(done.body).toMatchObject({ id: openItemId, status: 'done', meetingId, meetingTitle: `Endpoint test ${token}` });

      const doneList = await request(server()).get('/action-items').query({ status: 'done' }).expect(200);
      expect(doneList.body.map((i: { id: number }) => i.id)).toContain(openItemId);

      const reopened = await request(server()).patch(`/action-items/${openItemId}`).send({ status: 'open' }).expect(200);
      expect(reopened.body.status).toBe('open');
    });

    it('rejects an invalid status and an unknown action item', async () => {
      await request(server()).patch(`/action-items/${openItemId}`).send({ status: 'closed' }).expect(400);
      await request(server()).patch(`/action-items/${openItemId}`).send({}).expect(400);
      await request(server()).patch('/action-items/2147483000').send({ status: 'done' }).expect(404);
    });

    it('deletes the meeting and its action items', async () => {
      await request(server()).delete(`/meetings/${meetingId}`).expect(204);
      await request(server()).get(`/meetings/${meetingId}`).expect(404);
      await request(server()).delete(`/meetings/${meetingId}`).expect(404);
      const remaining = await request(server()).get('/action-items').query({ owner: 'Marco' }).expect(200);
      expect(remaining.body.map((i: { id: number }) => i.id)).not.toContain(ownerItemId);
    });
  });

  describe('CORS', () => {
    it('allows the configured web origin', async () => {
      const res = await request(server())
        .options('/meetings')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'PATCH')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    });

    it('does not allow other origins', async () => {
      const res = await request(server()).get('/capabilities').set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
