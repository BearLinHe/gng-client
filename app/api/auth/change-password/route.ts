import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import {
  setCustomerPassword,
  verifyCustomerPassword,
} from "@/lib/password-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "customer") {
    return NextResponse.json(
      { error: "客服账号使用统一密码，不支持在此修改" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "新密码至少需要 6 位" },
        { status: 400 },
      );
    }

    const isCurrentPasswordValid = await verifyCustomerPassword(
      customer.code,
      currentPassword,
    );
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: "当前密码不正确" },
        { status: 400 },
      );
    }

    await setCustomerPassword(customer.code, newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "修改密码失败" }, { status: 500 });
  }
}
