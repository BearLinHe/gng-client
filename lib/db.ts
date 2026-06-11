import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  sourcePgPool?: Pool;
  systemPgPool?: Pool;
};

let sourcePoolInstance: Pool | undefined;
let systemPoolInstance: Pool | undefined;

function getSourcePool(): Pool {
  const sourceConnectionString =
    process.env.READONLY_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!sourceConnectionString) {
    throw new Error("READONLY_DATABASE_URL or DATABASE_URL is not configured.");
  }

  const existingPool = sourcePoolInstance ?? globalForPg.sourcePgPool;
  if (existingPool) return existingPool;

  const pool = new Pool({
    connectionString: sourceConnectionString,
    max: 4,
    ssl: { rejectUnauthorized: true },
  });

  sourcePoolInstance = pool;
  if (process.env.NODE_ENV !== "production") {
    globalForPg.sourcePgPool = pool;
  }

  return pool;
}

function getSystemPool(): Pool {
  const systemConnectionString = process.env.SYSTEM_DATABASE_URL;

  if (!systemConnectionString) {
    throw new Error("SYSTEM_DATABASE_URL is not configured.");
  }

  const existingPool = systemPoolInstance ?? globalForPg.systemPgPool;
  if (existingPool) return existingPool;

  const pool = new Pool({
    connectionString: systemConnectionString,
    max: 4,
    ssl: { rejectUnauthorized: true },
  });

  systemPoolInstance = pool;
  if (process.env.NODE_ENV !== "production") {
    globalForPg.systemPgPool = pool;
  }

  return pool;
}

export async function withSourceReadOnlyTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const sourcePool = getSourcePool();
  const client = await sourcePool.connect();

  try {
    await client.query("BEGIN READ ONLY");
    const result = await work(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function withAppTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const systemPool = getSystemPool();
  const client = await systemPool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function withAppReadOnlyTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const systemPool = getSystemPool();
  const client = await systemPool.connect();

  try {
    await client.query("BEGIN READ ONLY");
    const result = await work(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const withReadOnlyTransaction = withSourceReadOnlyTransaction;

export function rows<T extends QueryResultRow>(value: { rows: T[] }): T[] {
  return value.rows;
}
