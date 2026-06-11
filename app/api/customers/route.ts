import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readCustomerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);

  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  return NextResponse.json({ customers: [customer] });
}
