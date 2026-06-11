import { NextRequest, NextResponse } from "next/server";

import {
  authenticateCustomer,
  createSessionToken,
  sessionCookieName,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: string; password?: string };
    const customer = await authenticateCustomer(
      body.code ?? "",
      body.password ?? "",
    );

    if (!customer) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ customer });
    response.cookies.set(sessionCookieName, createSessionToken(customer), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
