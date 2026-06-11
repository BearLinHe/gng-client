import { Pool, type PoolClient, type QueryResultRow } from "pg";

const sourceConnectionString =
  process.env.READONLY_DATABASE_URL ?? process.env.DATABASE_URL;
const systemConnectionString = process.env.SYSTEM_DATABASE_URL;

if (!sourceConnectionString) {
  throw new Error("READONLY_DATABASE_URL or DATABASE_URL is not configured.");
}

const globalForPg = globalThis as typeof globalThis & {
  sourcePgPool?: Pool;
  systemPgPool?: Pool;
};

export const sourcePool =
  globalForPg.sourcePgPool ??
  new Pool({
    connectionString: sourceConnectionString,
    max: 4,
    ssl: { rejectUnauthorized: true },
  });

export const systemPool = systemConnectionString
  ? (globalForPg.systemPgPool ??
      new Pool({
        connectionString: systemConnectionString,
        max: 4,
        ssl: { rejectUnauthorized: true },
      }))
  : null;

if (process.env.NODE_ENV !== "production") {
  globalForPg.sourcePgPool = sourcePool;
  if (systemPool) globalForPg.systemPgPool = systemPool;
}

export async function withSourceReadOnlyTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
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
  if (!systemPool) {
    throw new Error("SYSTEM_DATABASE_URL is not configured.");
  }

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
  if (!systemPool) {
    throw new Error("SYSTEM_DATABASE_URL is not configured.");
  }

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
