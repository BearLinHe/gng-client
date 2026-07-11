import { NextRequest, NextResponse } from "next/server";

import { readCustomerSession } from "@/lib/auth";
import { getCustomerVisibilitySettings } from "@/lib/customer-settings";
import {
  updateAppointmentDetail,
  updateContainerDate,
  updateContainerText,
  updateWarehouseDetail,
  updateWarehouseDetailText,
  updateWarehouseAppointmentDetail,
  updateWarehouseAppointmentVisibility,
  getContainers,
  type DateFilterField,
  type EditableAppointmentField,
  type EditableContainerDateField,
  type EditableContainerTextField,
  type EditableWarehouseDetailField,
  type EditableWarehouseDetailTextField,
  type EditableWarehouseAppointmentField,
  type PickupStatus,
  type WarehouseDeliveryProgressStatus,
} from "@/lib/container-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const operationMode = searchParams.get("operationMode");
  const search = searchParams.get("search");
  const dateField = parseDateField(searchParams.get("dateField"));
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const warehouseDeliveryProgressStatus = parseWarehouseDeliveryProgressStatus(
    searchParams.get("warehouseDeliveryProgress"),
  );
  const pickupStatus = parsePickupStatus(searchParams.get("pickupStatus"));
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "100");

  try {
    const settings =
      customer.role === "admin"
        ? null
        : await getCustomerVisibilitySettings(customer.id);
    const result = await getContainers({
      customerId: customer.id,
      showAllWarehouseAppointments: customer.role === "admin",
      sourceChangeEventView:
        customer.role === "admin"
          ? "admin"
          : settings?.showSourceChangeNotifications
            ? "customer"
            : "none",
      operationMode,
      search,
      dateField,
      dateFrom,
      dateTo,
      warehouseDeliveryProgressStatus,
      pickupStatus,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "读取柜号数据失败" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const customer = readCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (customer.role !== "admin") {
    return NextResponse.json(
      { error: "客户账号只读，无法修改数据" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const payload = parsePatchPayload(body);
  if (!payload) {
    return NextResponse.json({ error: "更新参数不正确" }, { status: 400 });
  }

  try {
    if (payload.kind === "warehouseDetail") {
      const updated = await updateWarehouseDetail({
        customerId: customer.id,
        sourceOrderId: payload.sourceOrderId,
        sourceOrderDetailId: payload.sourceOrderDetailId,
        field: payload.field,
        value: payload.value,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "未找到可更新的仓点明细" },
          { status: 404 },
        );
      }

      return NextResponse.json({ warehouseDetail: updated });
    }

    if (payload.kind === "warehouseDetailText") {
      const updated = await updateWarehouseDetailText({
        customerId: customer.id,
        sourceOrderId: payload.sourceOrderId,
        sourceOrderDetailId: payload.sourceOrderDetailId,
        field: payload.field,
        value: payload.value,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "未找到可更新的仓点备注" },
          { status: 404 },
        );
      }

      return NextResponse.json({ warehouseDetailText: updated });
    }

    if (payload.kind === "warehouseAppointmentVisibility") {
      const updated = await updateWarehouseAppointmentVisibility({
        customerId: customer.id,
        sourceOrderId: payload.sourceOrderId,
        sourceOrderDetailId: payload.sourceOrderDetailId,
        sourceAppointmentLineId: payload.sourceAppointmentLineId,
        isCustomerVisible: payload.isCustomerVisible,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "未找到可设置的送仓预约" },
          { status: 404 },
        );
      }

      return NextResponse.json({ warehouseAppointmentVisibility: updated });
    }

    if (payload.kind === "warehouseAppointment") {
      const updated = await updateWarehouseAppointmentDetail({
        customerId: customer.id,
        sourceOrderId: payload.sourceOrderId,
        sourceOrderDetailId: payload.sourceOrderDetailId,
        sourceAppointmentLineId: payload.sourceAppointmentLineId,
        field: payload.field,
        value: payload.value,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "未找到可更新的送仓预约" },
          { status: 404 },
        );
      }

      return NextResponse.json({ warehouseAppointment: updated });
    }

    if (payload.kind === "appointment") {
      const updated = await updateAppointmentDetail({
        customerId: customer.id,
        sourceOrderId: payload.sourceOrderId,
        sourceAppointmentId: payload.sourceAppointmentId,
        field: payload.field,
        value: payload.value,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "未找到可更新的预约" },
          { status: 404 },
        );
      }

      return NextResponse.json({ appointment: updated });
    }

    if (payload.kind === "containerText") {
      const updated = await updateContainerText({
        customerId: customer.id,
        sourceOrderId: payload.sourceOrderId,
        field: payload.field,
        value: payload.value,
      });

      if (!updated) {
        return NextResponse.json({ error: "未找到可更新的柜号" }, { status: 404 });
      }

      return NextResponse.json({ containerText: updated });
    }

    const updated = await updateContainerDate({
      customerId: customer.id,
      sourceOrderId: payload.sourceOrderId,
      field: payload.field,
      value: payload.value,
    });

    if (!updated) {
      return NextResponse.json({ error: "未找到可更新的柜号" }, { status: 404 });
    }

    return NextResponse.json({ dates: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE") {
      return NextResponse.json({ error: "日期格式不正确" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INVALID_DATETIME") {
      return NextResponse.json({ error: "送货时间格式不正确" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INVALID_PALLET_COUNT") {
      return NextResponse.json({ error: "板数必须是非负整数" }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "保存日期失败" }, { status: 500 });
  }
}

function parseDateField(value: string | null): DateFilterField | null {
  if (
    value === "orderDate" ||
    value === "etaDate" ||
    value === "lfdDate" ||
    value === "pickupDate"
  ) {
    return value;
  }

  return null;
}

function parsePickupStatus(value: string | null): PickupStatus | null {
  if (value === "pending" || value === "picked") return value;
  return null;
}

function parseWarehouseDeliveryProgressStatus(
  value: string | null,
): WarehouseDeliveryProgressStatus | null {
  if (value === "incomplete" || value === "complete") return value;
  return null;
}

function parsePatchPayload(
  value: unknown,
):
  | {
      kind: "date";
      sourceOrderId: string;
      field: EditableContainerDateField;
      value: string | null;
    }
  | {
      kind: "appointment";
      sourceOrderId: string;
      sourceAppointmentId: string;
      field: EditableAppointmentField;
      value: string | null;
    }
  | {
      kind: "warehouseDetail";
      sourceOrderId: string;
      sourceOrderDetailId: string;
      field: EditableWarehouseDetailField;
      value: string | null;
    }
  | {
      kind: "warehouseDetailText";
      sourceOrderId: string;
      sourceOrderDetailId: string;
      field: EditableWarehouseDetailTextField;
      value: string | null;
    }
  | {
      kind: "warehouseAppointment";
      sourceOrderId: string;
      sourceOrderDetailId: string;
      sourceAppointmentLineId: string;
      field: EditableWarehouseAppointmentField;
      value: string | null;
    }
  | {
      kind: "warehouseAppointmentVisibility";
      sourceOrderId: string;
      sourceOrderDetailId: string;
      sourceAppointmentLineId: string;
      isCustomerVisible: boolean;
    }
  | {
      kind: "containerText";
      sourceOrderId: string;
      field: EditableContainerTextField;
      value: string | null;
    }
  | null {
  if (!value || typeof value !== "object") return null;

  const body = value as {
    kind?: unknown;
    sourceOrderId?: unknown;
    sourceOrderDetailId?: unknown;
    sourceAppointmentId?: unknown;
    sourceAppointmentLineId?: unknown;
    isCustomerVisible?: unknown;
    field?: unknown;
    value?: unknown;
  };

  if (typeof body.sourceOrderId !== "string" || !body.sourceOrderId.trim()) {
    return null;
  }

  if (
    body.value !== null &&
    body.value !== undefined &&
    typeof body.value !== "string"
  ) {
    return null;
  }

  const parsedValue = typeof body.value === "string" ? body.value : null;

  if (body.kind === "warehouseDetail") {
    if (
      typeof body.sourceOrderDetailId !== "string" ||
      !body.sourceOrderDetailId.trim() ||
      !isEditableWarehouseDetailField(body.field)
    ) {
      return null;
    }

    return {
      kind: "warehouseDetail",
      sourceOrderId: body.sourceOrderId.trim(),
      sourceOrderDetailId: body.sourceOrderDetailId.trim(),
      field: body.field,
      value: parsedValue,
    };
  }

  if (body.kind === "warehouseDetailText") {
    if (
      typeof body.sourceOrderDetailId !== "string" ||
      !body.sourceOrderDetailId.trim() ||
      !isEditableWarehouseDetailTextField(body.field)
    ) {
      return null;
    }

    return {
      kind: "warehouseDetailText",
      sourceOrderId: body.sourceOrderId.trim(),
      sourceOrderDetailId: body.sourceOrderDetailId.trim(),
      field: body.field,
      value: parsedValue,
    };
  }

  if (body.kind === "warehouseAppointment") {
    if (
      typeof body.sourceOrderDetailId !== "string" ||
      !body.sourceOrderDetailId.trim() ||
      typeof body.sourceAppointmentLineId !== "string" ||
      !body.sourceAppointmentLineId.trim() ||
      !isEditableWarehouseAppointmentField(body.field)
    ) {
      return null;
    }

    return {
      kind: "warehouseAppointment",
      sourceOrderId: body.sourceOrderId.trim(),
      sourceOrderDetailId: body.sourceOrderDetailId.trim(),
      sourceAppointmentLineId: body.sourceAppointmentLineId.trim(),
      field: body.field,
      value: parsedValue,
    };
  }

  if (body.kind === "warehouseAppointmentVisibility") {
    if (
      typeof body.sourceOrderDetailId !== "string" ||
      !body.sourceOrderDetailId.trim() ||
      typeof body.sourceAppointmentLineId !== "string" ||
      !body.sourceAppointmentLineId.trim() ||
      typeof body.isCustomerVisible !== "boolean"
    ) {
      return null;
    }

    return {
      kind: "warehouseAppointmentVisibility",
      sourceOrderId: body.sourceOrderId.trim(),
      sourceOrderDetailId: body.sourceOrderDetailId.trim(),
      sourceAppointmentLineId: body.sourceAppointmentLineId.trim(),
      isCustomerVisible: body.isCustomerVisible,
    };
  }

  if (body.kind === "appointment") {
    if (
      typeof body.sourceAppointmentId !== "string" ||
      !body.sourceAppointmentId.trim() ||
      !isEditableAppointmentField(body.field)
    ) {
      return null;
    }

    return {
      kind: "appointment",
      sourceOrderId: body.sourceOrderId.trim(),
      sourceAppointmentId: body.sourceAppointmentId.trim(),
      field: body.field,
      value: parsedValue,
    };
  }

  if (body.kind === "containerText") {
    if (!isEditableContainerTextField(body.field)) return null;

    return {
      kind: "containerText",
      sourceOrderId: body.sourceOrderId.trim(),
      field: body.field,
      value: parsedValue,
    };
  }

  if (!isEditableDateField(body.field)) {
    return null;
  }

  return {
    kind: "date",
    sourceOrderId: body.sourceOrderId.trim(),
    field: body.field,
    value: parsedValue,
  };
}

function isEditableWarehouseDetailField(
  value: unknown,
): value is EditableWarehouseDetailField {
  return value === "actualPallets";
}

function isEditableWarehouseDetailTextField(
  value: unknown,
): value is EditableWarehouseDetailTextField {
  return value === "customerNote" || value === "windowPeriod";
}

function isEditableContainerTextField(
  value: unknown,
): value is EditableContainerTextField {
  return value === "extraChargeResponsibility";
}

function isEditableWarehouseAppointmentField(
  value: unknown,
): value is EditableWarehouseAppointmentField {
  return (
    value === "appointmentNumber" ||
    value === "deliveryDate" ||
    value === "effectivePallets"
  );
}

function isEditableDateField(
  value: unknown,
): value is EditableContainerDateField {
  return (
    value === "orderDate" ||
    value === "etaDate" ||
    value === "lfdDate" ||
    value === "pickupDate"
  );
}

function isEditableAppointmentField(
  value: unknown,
): value is EditableAppointmentField {
  return (
    value === "warehousePoint" ||
    value === "isaNumber" ||
    value === "deliveryTime" ||
    value === "palletCount"
  );
}
