import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);

  if (!customer) {
    return NextResponse.json({ customer: null }, { status: 401 });
  }

  return NextResponse.json({ customer });
}
