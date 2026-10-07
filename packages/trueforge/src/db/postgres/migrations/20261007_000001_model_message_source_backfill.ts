import { sql, type Kysely } from 'kysely';

/**
 * Backfill `source` on model.message events, turn state.output, and assistant
 * context bodies from the session agent model FQN (`provider/model`), prefixed
 * with model_provider type when known (`truefoundry` otherwise — TF providers
 * are not stored in model_provider).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db);

  await sql`
    UPDATE session_event e
    SET event = jsonb_set(
      e.event,
      '{source}',
      to_jsonb(COALESCE(mp.manifest->>'type', 'truefoundry') || '/' || m.model_name),
      true
    )
    FROM session s
    LEFT JOIN agent a
      ON a.tenant_id = s.tenant_id
     AND a.id = s.agent_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(s.agent_spec #>> '{model,name}', a.manifest #>> '{model,name}') AS model_name
    ) m
    LEFT JOIN model_provider mp
      ON mp.tenant_id = s.tenant_id
     AND mp.name = split_part(m.model_name, '/', 1)
    WHERE e.session_id = s.session_id
      AND e.event->>'type' = 'model.message'
      AND e.event->>'source' IS NULL
      AND m.model_name IS NOT NULL
  `.execute(db);

  await sql`
    UPDATE turn t
    SET state = jsonb_set(
      t.state,
      '{output,source}',
      to_jsonb(COALESCE(mp.manifest->>'type', 'truefoundry') || '/' || m.model_name),
      true
    )
    FROM session s
    LEFT JOIN agent a
      ON a.tenant_id = s.tenant_id
     AND a.id = s.agent_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(s.agent_spec #>> '{model,name}', a.manifest #>> '{model,name}') AS model_name
    ) m
    LEFT JOIN model_provider mp
      ON mp.tenant_id = s.tenant_id
     AND mp.name = split_part(m.model_name, '/', 1)
    WHERE t.session_id = s.session_id
      AND t.state->'output'->>'type' = 'model.message'
      AND t.state->'output'->>'source' IS NULL
      AND m.model_name IS NOT NULL
  `.execute(db);

  await sql`
    UPDATE thread_context_log c
    SET body = jsonb_set(
      c.body,
      '{source}',
      to_jsonb(COALESCE(mp.manifest->>'type', 'truefoundry') || '/' || m.model_name),
      true
    )
    FROM session s
    LEFT JOIN agent a
      ON a.tenant_id = s.tenant_id
     AND a.id = s.agent_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(s.agent_spec #>> '{model,name}', a.manifest #>> '{model,name}') AS model_name
    ) m
    LEFT JOIN model_provider mp
      ON mp.tenant_id = s.tenant_id
     AND mp.name = split_part(m.model_name, '/', 1)
    WHERE c.session_id = s.session_id
      AND c.body->>'role' = 'assistant'
      AND c.body->>'source' IS NULL
      AND m.model_name IS NOT NULL
  `.execute(db);
}

/** Data backfill — not reversed. */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db);
}
