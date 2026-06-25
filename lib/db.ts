import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// DEMO MODE: the backend / DATABASE_URL is disabled on this branch. The real
// neon() call throws at import time when DATABASE_URL is missing, which breaks
// the build because every API route imports this module. To keep the build
// green we lazily create the client only when a query actually runs, and throw
// a clear error at call time instead of at import time.
let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. The backend is disabled on this demo branch."
    );
  }
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Proxy so existing `sql\`...\`` tagged-template calls keep working, but the
// underlying neon client is only instantiated on first use (never at import).
export const sql = ((...args: unknown[]) => {
  // @ts-expect-error - forward tagged-template args to the real client
  return getSql()(...args);
}) as unknown as NeonQueryFunction<false, false>;
