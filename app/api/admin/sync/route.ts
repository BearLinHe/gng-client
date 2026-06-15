import { NextRequest, NextResponse } from "next/server";

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

  try {
    const summary = await syncSourceToSystem({
      logger: (message) => {
        logs.push(message);
        if (logs.length > 250) logs.shift();
      },
    });

    return NextResponse.json({
      ...summary,
      startedAt,
      finishedAt: new Date().toISOString(),
      logs,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error && "code" in error
        ? String(error.code)
        : undefined;

    if (errorCode === "SYNC_ALREADY_RUNNING") {
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

    console.error(error);
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

  if (!syncSecret) {
    if (process.env.NODE_ENV !== "production") return null;

    return NextResponse.json(
      { error: "SYNC_SECRET or CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-sync-secret");
  const isAuthorized =
    authorization === `Bearer ${syncSecret}` || headerSecret === syncSecret;

  if (isAuthorized) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
