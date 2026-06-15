import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import { syncSourceToSystem } from "@/lib/source-sync.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return runSync(request);
}

export async function POST(request: NextRequest) {
  return runSync(request);
}

async function runSync(request: NextRequest) {
  const authorizationError = validateSyncRequest(request);
  if (authorizationError) return authorizationError;

  const logs: string[] = [];
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();

  console.info(
    `[source-sync] started at=${startedAt} trigger=${getSyncTrigger(request)}`,
  );

  try {
    const summary = await syncSourceToSystem({
      logger: (message) => {
        logs.push(message);
        if (logs.length > 250) logs.shift();
        console.info(`[source-sync] ${message}`);
      },
    });
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;

    console.info(
      `[source-sync] success finishedAt=${finishedAt} durationMs=${durationMs} customers=${summary.customers} containers=${summary.containers} appointments=${summary.appointments} warehouseDetails=${summary.warehouseDetails} warehouseAppointments=${summary.warehouseAppointments}`,
    );

    return NextResponse.json({
      ...summary,
      startedAt,
      finishedAt,
      logs,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : undefined;

    if (errorCode === "SYNC_ALREADY_RUNNING") {
      console.warn("[source-sync] skipped reason=already_running");
      return NextResponse.json(
        {
          status: "skipped",
          error: "同步正在运行，请稍后再试",
          startedAt,
          finishedAt: new Date().toISOString(),
        },
        { status: 409 },
      );
    }

    console.error(
      `[source-sync] failed durationMs=${Date.now() - startedAtMs}`,
      error,
    );
    return NextResponse.json(
      {
        status: "error",
        error: "自动同步失败",
        message: error instanceof Error ? error.message : "Unknown error",
        startedAt,
        finishedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

function validateSyncRequest(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET ?? process.env.CRON_SECRET;
  const userAgent = request.headers.get("user-agent") ?? "";
  const isVercelCron = userAgent.includes("vercel-cron/1.0");

  if (isVercelCron) return null;

  const customer = readCustomerSession(request);
  if (customer?.role === "admin") return null;

  if (!syncSecret) {
    if (process.env.NODE_ENV !== "production") return null;

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-sync-secret");
  const isAuthorized =
    authorization === `Bearer ${syncSecret}` || headerSecret === syncSecret;

  if (isAuthorized) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function getSyncTrigger(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgent.includes("vercel-cron/1.0")) return "vercel-cron";
  return request.method === "POST" ? "manual-post" : "manual-get";
}
