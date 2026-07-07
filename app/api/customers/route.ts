import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import { rows, withAppReadOnlyTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

type CustomerRow = {
  id: string;
  code: string | null;
  name: string;
};

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);

  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (customer.role === "admin") {
    const customers = await withAppReadOnlyTransaction(async (client) => {
      const result = await client.query<CustomerRow>(
        `
          select
            source_customer_id as id,
            code,
            coalesce(nullif(name, ''), code) as name
          from public.portal_customers
          where source_active = true
          order by lower(coalesce(nullif(name, ''), code)), lower(code)
        `,
      );

      return rows(result).map((row) => ({
        ...row,
        role: "admin" as const,
      }));
    });

    return NextResponse.json({ customers });
  }

  return NextResponse.json({ customers: [customer] });
}
