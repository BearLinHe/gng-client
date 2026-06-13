import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import {
  getContainerBillDocument,
  saveContainerBillDocument,
} from "@/lib/container-data";

export const dynamic = "force-dynamic";

const maxDocumentBytes = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const sourceOrderId = request.nextUrl.searchParams
    .get("sourceOrderId")
    ?.trim();
  if (!sourceOrderId) {
    return NextResponse.json({ error: "账单参数不正确" }, { status: 400 });
  }

  try {
    const document = await getContainerBillDocument({
      customerId: customer.id,
      sourceOrderId,
    });

    if (!document) {
      return NextResponse.json({ error: "账单不存在" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(document.data), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          document.fileName ?? "bill-document",
        )}`,
        "Content-Length": String(document.fileSize ?? document.data.length),
        "Content-Type": document.mimeType ?? "application/octet-stream",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "读取账单失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "admin") {
    return NextResponse.json(
      { error: "客户账号只读，无法上传账单" },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "上传格式不正确" }, { status: 400 });
  }

  const sourceOrderId = getStringValue(formData.get("sourceOrderId"));
  const file = formData.get("file");

  if (!sourceOrderId || !isFormFile(file)) {
    return NextResponse.json({ error: "上传参数不正确" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }

  if (file.size > maxDocumentBytes) {
    return NextResponse.json(
      { error: "文件不能超过 10MB" },
      { status: 400 },
    );
  }

  const mimeType = normalizeDocumentMimeType(file);
  if (!mimeType) {
    return NextResponse.json(
      { error: "只支持图片或 PDF 文件" },
      { status: 400 },
    );
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const document = await saveContainerBillDocument({
      customerId: customer.id,
      sourceOrderId,
      fileName: sanitizeFileName(file.name),
      mimeType,
      fileSize: file.size,
      data,
    });

    if (!document) {
      return NextResponse.json(
        { error: "未找到可上传账单的柜号" },
        { status: 404 },
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "上传账单失败" }, { status: 500 });
  }
}

function getStringValue(value: FormDataEntryValue | string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isFormFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "name" in value
  );
}

function normalizeDocumentMimeType(file: File) {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name)
  ) {
    return mimeType.startsWith("image/") ? mimeType : "image/*";
  }

  return "";
}

function sanitizeFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return normalized || "bill";
}
