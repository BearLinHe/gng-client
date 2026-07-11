import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import { acknowledgeSourceChangeEvents } from "@/lib/container-data";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json({ error: "更新参数不正确" }, { status: 400 });
  }

  try {
    if (customer.role !== "admin") {
      return NextResponse.json(
        { error: "客户账号只读，无法处理变动通知" },
        { status: 403 },
      );
    }

    const updatedEventIds = await acknowledgeSourceChangeEvents({
      customerId: customer.id,
      eventIds: payload.eventIds,
      notifyCustomer: payload.action === "notifyCustomer",
    });

    return NextResponse.json({ eventIds: updatedEventIds });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "处理变动通知失败" }, { status: 500 });
  }
}

function parsePayload(value: unknown):
  | {
      action: "notifyCustomer" | "acknowledge";
      eventIds: number[];
    }
  | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { action?: unknown; eventIds?: unknown };

  if (
    raw.action !== "notifyCustomer" &&
    raw.action !== "acknowledge"
  ) {
    return null;
  }

  if (!Array.isArray(raw.eventIds)) return null;

  const eventIds = raw.eventIds
    .map((eventId) => Number(eventId))
    .filter((eventId) => Number.isSafeInteger(eventId) && eventId > 0);

  if (!eventIds.length) return null;

  return {
    action: raw.action,
    eventIds,
  };
}
