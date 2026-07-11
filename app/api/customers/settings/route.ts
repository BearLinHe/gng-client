import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import {
  getCustomerVisibilitySettings,
  normalizeSettings,
  updateCustomerVisibilitySettings,
  type CustomerVisibilitySettings,
} from "@/lib/customer-settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const settings = await getCustomerVisibilitySettings(customer.id);
    if (!settings) {
      return NextResponse.json({ error: "未找到客户设置" }, { status: 404 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "读取客户设置失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "admin") {
    return NextResponse.json(
      { error: "客户账号只读，无法修改设置" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const settings = parseSettings(body);
  if (!settings) {
    return NextResponse.json({ error: "客户设置参数不正确" }, { status: 400 });
  }

  try {
    const updated = await updateCustomerVisibilitySettings({
      customerId: customer.id,
      settings,
    });

    if (!updated) {
      return NextResponse.json({ error: "未找到客户设置" }, { status: 404 });
    }

    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "保存客户设置失败" }, { status: 500 });
  }
}

function parseSettings(value: unknown): CustomerVisibilitySettings | null {
  if (!value || typeof value !== "object") return null;

  const rawSettings =
    "settings" in value && value.settings && typeof value.settings === "object"
      ? (value.settings as Record<string, unknown>)
      : (value as Record<string, unknown>);

  const keys: Array<keyof CustomerVisibilitySettings> = [
    "showAppointmentNumber",
    "showDeliveryDate",
    "showEffectivePallets",
    "showPod",
    "showBol",
    "showSourceChangeNotifications",
  ];

  for (const key of keys) {
    if (
      rawSettings[key] !== undefined &&
      typeof rawSettings[key] !== "boolean"
    ) {
      return null;
    }
  }

  return normalizeSettings(
    Object.fromEntries(
      keys
        .filter((key) => rawSettings[key] !== undefined)
        .map((key) => [key, rawSettings[key]]),
    ) as Partial<CustomerVisibilitySettings>,
  );
}
