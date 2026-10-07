import { sql, type Kysely } from 'kysely';

/**
 * SQLite mirror of postgres/migrations/20261007_000001_model_message_source_backfill.ts.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.transaction().execute(async trx => {
    await sql`
      UPDATE session_event
      SET event = jsonb_set(
        event,
        '$.source',
        jsonb(json_quote(
          COALESCE(json_extract(mp.manifest, '$.type'), 'truefoundry') || '/' || m.model_name
        ))
      )
      FROM (
        SELECT
          s.session_id AS sid,
          s.tenant_id AS tenant_id,
          COALESCE(
            json_extract(s.agent_spec, '$.model.name'),
            json_extract(a.manifest, '$.model.name')
          ) AS model_name
        FROM session s
        LEFT JOIN agent a
          ON a.tenant_id = s.tenant_id
         AND a.id = s.agent_id
      ) m
      LEFT JOIN model_provider mp
        ON mp.tenant_id = m.tenant_id
       AND mp.name = substr(m.model_name, 1, instr(m.model_name, '/') - 1)
      WHERE session_event.session_id = m.sid
        AND json_extract(session_event.event, '$.type') = 'model.message'
        AND json_extract(session_event.event, '$.source') IS NULL
        AND m.model_name IS NOT NULL
    `.execute(trx);

    await sql`
      UPDATE turn
      SET state = jsonb_set(
        state,
        '$.output.source',
        jsonb(json_quote(
          COALESCE(json_extract(mp.manifest, '$.type'), 'truefoundry') || '/' || m.model_name
        ))
      )
      FROM (
        SELECT
          s.session_id AS sid,
          s.tenant_id AS tenant_id,
          COALESCE(
            json_extract(s.agent_spec, '$.model.name'),
            json_extract(a.manifest, '$.model.name')
          ) AS model_name
        FROM session s
        LEFT JOIN agent a
          ON a.tenant_id = s.tenant_id
         AND a.id = s.agent_id
      ) m
      LEFT JOIN model_provider mp
        ON mp.tenant_id = m.tenant_id
       AND mp.name = substr(m.model_name, 1, instr(m.model_name, '/') - 1)
      WHERE turn.session_id = m.sid
        AND json_extract(turn.state, '$.output.type') = 'model.message'
        AND json_extract(turn.state, '$.output.source') IS NULL
        AND m.model_name IS NOT NULL
    `.execute(trx);

    await sql`
      UPDATE thread_context_log
      SET body = jsonb_set(
        body,
        '$.source',
        jsonb(json_quote(
          COALESCE(json_extract(mp.manifest, '$.type'), 'truefoundry') || '/' || m.model_name
        ))
      )
      FROM (
        SELECT
          s.session_id AS sid,
          s.tenant_id AS tenant_id,
          COALESCE(
            json_extract(s.agent_spec, '$.model.name'),
            json_extract(a.manifest, '$.model.name')
          ) AS model_name
        FROM session s
        LEFT JOIN agent a
          ON a.tenant_id = s.tenant_id
         AND a.id = s.agent_id
      ) m
      LEFT JOIN model_provider mp
        ON mp.tenant_id = m.tenant_id
       AND mp.name = substr(m.model_name, 1, instr(m.model_name, '/') - 1)
      WHERE thread_context_log.session_id = m.sid
        AND json_extract(thread_context_log.body, '$.role') = 'assistant'
        AND json_extract(thread_context_log.body, '$.source') IS NULL
        AND m.model_name IS NOT NULL
    `.execute(trx);
  });
}

/** Data backfill — not reversed. */
export async function down(_db: Kysely<unknown>): Promise<void> {
  // no-op
}
