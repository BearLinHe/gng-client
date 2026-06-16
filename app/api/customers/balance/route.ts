import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import {
  getCustomerBalance,
  updateCustomerBalance,
} from "@/lib/customer-balance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const balance = await getCustomerBalance(customer.id);
    if (!balance) {
      return NextResponse.json({ error: "未找到客户" }, { status: 404 });
    }

    return NextResponse.json({ balance });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "读取未结账款失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "admin") {
    return NextResponse.json(
      { error: "客户账号只读，无法修改欠款" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const balanceDueUsd = parseBalanceDueUsd(body);
  if (balanceDueUsd === null) {
    return NextResponse.json(
      { error: "请输入有效的美金金额" },
      { status: 400 },
    );
  }

  try {
    const balance = await updateCustomerBalance({
      customerId: customer.id,
      balanceDueUsd,
    });

    if (!balance) {
      return NextResponse.json({ error: "未找到客户" }, { status: 404 });
    }

    return NextResponse.json({ balance });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "保存未结账款失败" }, { status: 500 });
  }
}

function parseBalanceDueUsd(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    !("balanceDueUsd" in body)
  ) {
    return null;
  }

  const rawValue = String(
    (body as { balanceDueUsd?: unknown }).balanceDueUsd ?? "",
  )
    .trim()
    .replace(/[$,\s]/g, "");

  if (!/^\d+(\.\d{0,2})?$/.test(rawValue)) return null;

  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999.99) {
    return null;
  }

  return amount.toFixed(2);
}
