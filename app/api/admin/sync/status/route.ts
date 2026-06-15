import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import { rows, withAppReadOnlyTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

type SyncRunRow = {
  id: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  status: string;
  customerCount: number;
  containerCount: number;
  appointmentCount: number;
  message: string | null;
};

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "admin") {
    return NextResponse.json(
      { error: "客户账号无权查看同步状态" },
      { status: 403 },
    );
  }

  try {
    const syncRun = await withAppReadOnlyTransaction(async (client) => {
      const result = await client.query<SyncRunRow>(
        `
          select
            id::text,
            started_at as "startedAt",
            finished_at as "finishedAt",
            status,
            customer_count as "customerCount",
            container_count as "containerCount",
            appointment_count as "appointmentCount",
            message
          from public.portal_sync_runs
          order by started_at desc
          limit 1
        `,
      );

      const row = rows(result)[0];
      return row ? toSyncRun(row) : null;
    });

    return NextResponse.json({ syncRun });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "读取同步状态失败" },
      { status: 500 },
    );
  }
}

function toSyncRun(row: SyncRunRow) {
  return {
    id: row.id,
    startedAt: formatDateTime(row.startedAt),
    finishedAt: formatDateTime(row.finishedAt),
    status: row.status,
    customerCount: row.customerCount,
    containerCount: row.containerCount,
    appointmentCount: row.appointmentCount,
    message: row.message,
  };
}

function formatDateTime(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}
