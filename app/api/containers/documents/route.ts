import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import {
  getWarehouseAppointmentDocument,
  saveWarehouseAppointmentDocument,
  type AppointmentDocumentType,
} from "@/lib/container-data";

export const dynamic = "force-dynamic";

const maxDocumentBytes = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const payload = parseDocumentParams({
    sourceOrderId: params.get("sourceOrderId"),
    sourceOrderDetailId: params.get("sourceOrderDetailId"),
    sourceAppointmentLineId: params.get("sourceAppointmentLineId"),
    documentType: params.get("documentType"),
  });

  if (!payload) {
    return NextResponse.json({ error: "文件参数不正确" }, { status: 400 });
  }

  try {
    const document = await getWarehouseAppointmentDocument({
      customerId: customer.id,
      ...payload,
    });

    if (!document) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(document.data), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          document.fileName ?? `${payload.documentType}-document`,
        )}`,
        "Content-Length": String(document.fileSize ?? document.data.length),
        "Content-Type": document.mimeType ?? "application/octet-stream",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "读取文件失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "admin") {
    return NextResponse.json(
      { error: "客户账号只读，无法上传文件" },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "上传格式不正确" }, { status: 400 });
  }

  const payload = parseDocumentParams({
    sourceOrderId: formData.get("sourceOrderId"),
    sourceOrderDetailId: formData.get("sourceOrderDetailId"),
    sourceAppointmentLineId: formData.get("sourceAppointmentLineId"),
    documentType: formData.get("documentType"),
  });
  const file = formData.get("file");

  if (!payload || !isFormFile(file)) {
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
    const document = await saveWarehouseAppointmentDocument({
      customerId: customer.id,
      ...payload,
      fileName: sanitizeFileName(file.name),
      mimeType,
      fileSize: file.size,
      data,
    });

    if (!document) {
      return NextResponse.json(
        { error: "未找到可上传的预约" },
        { status: 404 },
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "上传文件失败" }, { status: 500 });
  }
}

function parseDocumentParams(value: {
  sourceOrderId: FormDataEntryValue | string | null;
  sourceOrderDetailId: FormDataEntryValue | string | null;
  sourceAppointmentLineId: FormDataEntryValue | string | null;
  documentType: FormDataEntryValue | string | null;
}):
  | {
      sourceOrderId: string;
      sourceOrderDetailId: string;
      sourceAppointmentLineId: string;
      documentType: AppointmentDocumentType;
    }
  | null {
  const sourceOrderId = getStringValue(value.sourceOrderId);
  const sourceOrderDetailId = getStringValue(value.sourceOrderDetailId);
  const sourceAppointmentLineId = getStringValue(value.sourceAppointmentLineId);
  const documentType = getStringValue(value.documentType);

  if (
    !sourceOrderId ||
    !sourceOrderDetailId ||
    !sourceAppointmentLineId ||
    (documentType !== "pod" && documentType !== "bol")
  ) {
    return null;
  }

  return {
    sourceOrderId,
    sourceOrderDetailId,
    sourceAppointmentLineId,
    documentType,
  };
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
  return normalized || "document";
}
