import { sql } from 'kysely';
import { createSqliteDb } from '../../../../../src/db/sqlite/client';
import { up } from '../../../../../src/db/sqlite/migrations/20261007_000001_model_message_source_backfill';

describe('SQLite model.message source backfill migration', () => {
  it('stamps source from inline agent_spec model FQN and provider type', async () => {
    const db = createSqliteDb(':memory:');
    try {
      await sql`
        CREATE TABLE session (
          session_id TEXT NOT NULL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          agent_id TEXT,
          agent_spec BLOB
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE agent (
          id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          manifest BLOB NOT NULL,
          PRIMARY KEY (tenant_id, id)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE model_provider (
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          manifest BLOB NOT NULL,
          PRIMARY KEY (tenant_id, name)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE session_event (
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          event BLOB NOT NULL,
          PRIMARY KEY (session_id, turn_id, event_id)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE turn (
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          state BLOB NOT NULL,
          PRIMARY KEY (session_id, turn_id)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE thread_context_log (
          session_id TEXT NOT NULL,
          append_id INTEGER NOT NULL PRIMARY KEY,
          body BLOB NOT NULL
        ) STRICT
      `.execute(db);

      const agentSpec = JSON.stringify({ model: { name: 'acme/gpt-test' } });
      const providerManifest = JSON.stringify({ type: 'openai', models: [] });
      await sql`
        INSERT INTO session (session_id, tenant_id, agent_id, agent_spec)
        VALUES ('sess-1', 'tenant-1', NULL, jsonb(${agentSpec}))
      `.execute(db);
      await sql`
        INSERT INTO model_provider (tenant_id, name, manifest)
        VALUES ('tenant-1', 'acme', jsonb(${providerManifest}))
      `.execute(db);
      await sql`
        INSERT INTO session_event (session_id, turn_id, event_id, event)
        VALUES (
          'sess-1',
          'turn-1',
          'evt-1',
          jsonb(${JSON.stringify({ type: 'model.message', id: 'evt-1', thread_id: 'main', content: 'hi' })})
        )
      `.execute(db);
      await sql`
        INSERT INTO turn (session_id, turn_id, state)
        VALUES (
          'sess-1',
          'turn-1',
          jsonb(${JSON.stringify({
            status: 'done',
            output: { type: 'model.message', id: 'evt-1', thread_id: 'main', content: 'hi' },
            required_actions: [],
            completed_at: '2026-10-07T00:00:00.000Z',
          })})
        )
      `.execute(db);
      await sql`
        INSERT INTO thread_context_log (session_id, append_id, body)
        VALUES (
          'sess-1',
          1,
          jsonb(${JSON.stringify({ role: 'assistant', content: 'hi' })})
        )
      `.execute(db);

      await up(db);

      const event = await sql<{ event: { source?: string } }>`
        SELECT json(event) AS event FROM session_event WHERE event_id = 'evt-1'
      `.execute(db);
      expect(event.rows[0]?.event.source).toBe('openai/acme/gpt-test');

      const turn = await sql<{ state: { output?: { source?: string } } }>`
        SELECT json(state) AS state FROM turn WHERE turn_id = 'turn-1'
      `.execute(db);
      expect(turn.rows[0]?.state.output?.source).toBe('openai/acme/gpt-test');

      const context = await sql<{ body: { source?: string } }>`
        SELECT json(body) AS body FROM thread_context_log WHERE append_id = 1
      `.execute(db);
      expect(context.rows[0]?.body.source).toBe('openai/acme/gpt-test');
    } finally {
      await db.destroy();
    }
  });

  it('uses truefoundry provider type when the model provider row is missing', async () => {
    const db = createSqliteDb(':memory:');
    try {
      await sql`
        CREATE TABLE session (
          session_id TEXT NOT NULL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          agent_id TEXT,
          agent_spec BLOB
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE agent (
          id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          manifest BLOB NOT NULL,
          PRIMARY KEY (tenant_id, id)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE model_provider (
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          manifest BLOB NOT NULL,
          PRIMARY KEY (tenant_id, name)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE session_event (
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          event BLOB NOT NULL,
          PRIMARY KEY (session_id, turn_id, event_id)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE turn (
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          state BLOB NOT NULL,
          PRIMARY KEY (session_id, turn_id)
        ) STRICT
      `.execute(db);
      await sql`
        CREATE TABLE thread_context_log (
          session_id TEXT NOT NULL,
          append_id INTEGER NOT NULL PRIMARY KEY,
          body BLOB NOT NULL
        ) STRICT
      `.execute(db);

      const agentSpec = JSON.stringify({ model: { name: 'gone/model' } });
      await sql`
        INSERT INTO session (session_id, tenant_id, agent_id, agent_spec)
        VALUES ('sess-2', 'tenant-1', NULL, jsonb(${agentSpec}))
      `.execute(db);
      await sql`
        INSERT INTO session_event (session_id, turn_id, event_id, event)
        VALUES (
          'sess-2',
          'turn-1',
          'evt-2',
          jsonb(${JSON.stringify({ type: 'model.message', id: 'evt-2', thread_id: 'main' })})
        )
      `.execute(db);

      await up(db);

      const event = await sql<{ event: { source?: string } }>`
        SELECT json(event) AS event FROM session_event WHERE event_id = 'evt-2'
      `.execute(db);
      expect(event.rows[0]?.event.source).toBe('truefoundry/gone/model');
    } finally {
      await db.destroy();
    }
  });
});
