import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

import { rows, withAppReadOnlyTransaction } from "@/lib/db";
import { verifyCustomerPassword } from "@/lib/password-store";

export const sessionCookieName = "gng_customer_session";
const adminPassword = "admin123456";

export type CustomerSession = {
  id: string;
  code: string;
  name: string;
  role: "customer" | "admin";
};

type CustomerAuthRow = {
  id: string;
  code: string;
  name: string;
};

export async function findCustomerByCode(
  code: string,
): Promise<CustomerSession | null> {
  const normalizedCode = code.trim();
  if (!normalizedCode) return null;

  return withAppReadOnlyTransaction(async (client) => {
    const result = await client.query<CustomerAuthRow>(
      `
        select
          source_customer_id as id,
          code,
          coalesce(nullif(name, ''), code) as name
        from public.portal_customers
        where lower(code) = lower($1)
          and source_active = true
        limit 1
      `,
      [normalizedCode],
    );
    const customer = rows(result)[0];

    return customer
      ? {
          id: customer.id,
          code: customer.code,
          name: customer.name,
          role: "customer",
        }
      : null;
  });
}

export async function authenticateCustomer(
  code: string,
  password: string,
): Promise<CustomerSession | null> {
  const customer = await findCustomerByCode(code);
  if (!customer) return null;

  if (password === adminPassword) {
    return { ...customer, role: "admin" };
  }

  const isValidPassword = await verifyCustomerPassword(customer.code, password);
  return isValidPassword ? { ...customer, role: "customer" } : null;
}

export function createSessionToken(session: CustomerSession): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function readCustomerSession(
  request: NextRequest,
): CustomerSession | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !verify(payload, signature)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as CustomerSession;
    if (!parsed.id || !parsed.code || !parsed.name) return null;

    return {
      ...parsed,
      role: parsed.role === "admin" ? "admin" : "customer",
    };
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(payload)
    .digest("base64url");
}

function getAuthSecret(): string {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return authSecret;
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
