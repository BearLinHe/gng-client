import { NextRequest, NextResponse } from "next/server";

import {
  createSessionToken,
  findCustomerByCode,
  readCustomerSession,
  sessionCookieName,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = readCustomerSession(request);
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "没有切换客户权限" }, { status: 403 });
    }

    const body = (await request.json()) as { code?: string };
    const customer = await findCustomerByCode(body.code ?? "");
    if (!customer) {
      return NextResponse.json({ error: "客户不存在或已停用" }, { status: 404 });
    }

    const nextSession = { ...customer, role: "admin" as const };
    const response = NextResponse.json({ customer: nextSession });
    response.cookies.set(sessionCookieName, createSessionToken(nextSession), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "切换客户失败" }, { status: 500 });
  }
}
