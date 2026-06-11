import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { rows, withAppTransaction } from "@/lib/db";

const defaultPassword = "111111";

type PasswordRow = {
  password_hash: string;
};

export async function verifyCustomerPassword(
  customerCode: string,
  password: string,
): Promise<boolean> {
  const normalizedCode = normalizeCode(customerCode);
  const storedHash = await withAppTransaction(async (client) => {
    const result = await client.query<PasswordRow>(
      `
        select password_hash
        from public.portal_customer_passwords
        where customer_code_normalized = $1
        limit 1
      `,
      [normalizedCode],
    );

    return rows(result)[0]?.password_hash;
  });

  if (!storedHash) return password === defaultPassword;

  return verifyPassword(password, storedHash);
}

export async function setCustomerPassword(
  customerCode: string,
  password: string,
): Promise<void> {
  await withAppTransaction(async (client) => {
    await client.query(
      `
        insert into public.portal_customer_passwords (
          customer_code_normalized,
          password_hash,
          updated_at
        )
        values ($1, $2, now())
        on conflict (customer_code_normalized)
        do update set
          password_hash = excluded.password_hash,
          updated_at = now()
      `,
      [normalizeCode(customerCode), hashPassword(password)],
    );
  });
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
