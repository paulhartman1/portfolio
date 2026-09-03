import { SupabaseClient } from '@supabase/supabase-js'

/**
 * An in-memory Supabase stub supporting the reads AND writes the review path
 * performs.
 *
 * It deliberately models three real behaviours that the review loop depends
 * on, so a test can fail for the right reason:
 *   * eq/in filters are applied as PostgREST would, so query-level scoping is
 *     observable rather than assumed;
 *   * the partial unique index on (experiment_id, md5(proposed_statement))
 *     WHERE origin='askcgt' raises a 23505, so idempotency is genuinely tested;
 *   * a table that was never registered returns empty, which is what an RLS
 *     denial looks like to application code.
 */

export type Row = Record<string, unknown>

export type StubQuery = { table: string; op: string; filters: Array<[string, string, unknown]> }

export type Stub = {
  client: SupabaseClient
  tables: Record<string, Row[]>
  queries: StubQuery[]
  /** Force the next write to a given table to fail, to test rollback paths. */
  failWrites: Set<string>
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${String(idCounter).padStart(8, '0')}-4000-8000-000000000000`
}

export function makeStubSupabase(initial: Record<string, Row[]> = {}): Stub {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map((r) => ({ ...r }))
  const queries: StubQuery[] = []
  const failWrites = new Set<string>()

  function builder(table: string) {
    const filters: Array<[string, string, unknown]> = []
    const record: StubQuery = { table, op: 'select', filters }
    queries.push(record)

    let pendingInsert: Row[] | null = null

    const apply = (): Row[] => {
      let rows = tables[table] ? [...tables[table]] : []
      for (const [op, column, value] of filters) {
        if (op === 'eq') rows = rows.filter((r) => r[column] === value)
        if (op === 'neq') rows = rows.filter((r) => r[column] !== value)
        if (op === 'in') rows = rows.filter((r) => (value as unknown[]).includes(r[column]))
      }
      return rows
    }

    const runInsert = (): { data: Row[] | null; error: Row | null } => {
      if (failWrites.has(table)) {
        return { data: null, error: { message: `simulated write failure on ${table}`, code: 'XXXXX' } }
      }
      const inserted: Row[] = []
      for (const row of pendingInsert ?? []) {
        // Partial unique index on askcgt-origin findings.
        if (table === 'experiment_findings' && row.origin === 'askcgt') {
          const clash = (tables[table] ?? []).some(
            (existing) =>
              existing.origin === 'askcgt' &&
              existing.experiment_id === row.experiment_id &&
              existing.proposed_statement === row.proposed_statement
          )
          if (clash) {
            return {
              data: null,
              error: {
                code: '23505',
                message:
                  'duplicate key value violates unique constraint "uniq_experiment_findings_askcgt_proposal"',
              },
            }
          }
        }
        const withId: Row = {
          id: row.id ?? nextId(table.slice(0, 4)),
          created_at: new Date().toISOString(),
          ...row,
        }
        tables[table] = tables[table] ?? []
        tables[table].push(withId)
        inserted.push(withId)
      }
      return { data: inserted, error: null }
    }

    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push(['eq', column, value])
        return chain
      },
      neq: (column: string, value: unknown) => {
        filters.push(['neq', column, value])
        return chain
      },
      in: (column: string, value: unknown) => {
        filters.push(['in', column, value])
        return chain
      },
      insert: (rows: Row | Row[]) => {
        record.op = 'insert'
        pendingInsert = Array.isArray(rows) ? rows : [rows]
        return chain
      },
      delete: () => {
        record.op = 'delete'
        return chain
      },
      maybeSingle: async () => ({ data: apply()[0] ?? null, error: null }),
      single: async () => {
        if (record.op === 'insert') {
          const result = runInsert()
          if (result.error) return { data: null, error: result.error }
          return { data: result.data?.[0] ?? null, error: null }
        }
        const rows = apply()
        return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not found' } }
      },
      then: (resolve: (value: { data: Row[] | null; error: Row | null }) => unknown) => {
        if (record.op === 'insert') return resolve(runInsert())
        if (record.op === 'delete') {
          if (failWrites.has(table)) {
            return resolve({ data: null, error: { message: `simulated delete failure on ${table}` } })
          }
          const doomed = new Set(apply())
          tables[table] = (tables[table] ?? []).filter((r) => !doomed.has(r))
          return resolve({ data: [], error: null })
        }
        return resolve({ data: apply(), error: null })
      },
    }
    return chain
  }

  return {
    client: { from: (table: string) => builder(table) } as unknown as SupabaseClient,
    tables,
    queries,
    failWrites,
  }
}
