import {
  rows,
  withAppTransaction,
  withAppReadOnlyTransaction,
  withSourceReadOnlyTransaction,
} from "@/lib/db";

export type CustomerOption = {
  id: string;
  code: string | null;
  name: string;
  containerCount: number;
};

export type ContainerRecord = {
  sourceOrderId: string;
  containerNumber: string;
  customerId: string | null;
  customerCode: string | null;
  customerName: string;
  orderDate: string | null;
  etaDate: string | null;
  lfdDate: string | null;
  pickupDate: string | null;
  operationMode: string | null;
  operationModeLabel: string;
  destination: string | null;
  warehousePoints: string | null;
  appointments: DeliveryAppointment[];
  warehouseDetails: WarehouseDetail[];
  billDocument: AppointmentDocumentMeta;
};

export type DeliveryAppointment = {
  sourceAppointmentId: string;
  warehousePoint: string;
  isaNumber: string | null;
  deliveryTime: string | null;
  palletCount: number | null;
};

export type WarehouseDetail = {
  sourceOrderDetailId: string;
  deliveryNature: string | null;
  warehousePoint: string;
  windowPeriod: string | null;
  volume: string | null;
  estimatedPallets: number | null;
  volumePercentage: string | null;
  warehouseLocation: string | null;
  actualPallets: number | null;
  remainingPallets: number | null;
  deliveryProgress: string | null;
  fba: string | null;
  notes: string | null;
  po: string | null;
  appointments: WarehouseAppointment[];
};

export type WarehouseAppointment = {
  sourceOrderDetailId: string;
  sourceAppointmentLineId: string;
  sourceAppointmentId: string | null;
  appointmentNumber: string | null;
  deliveryDate: string | null;
  estimatedPallets: number | null;
  rejectedPallets: number | null;
  effectivePallets: number | null;
  podDocument: AppointmentDocumentMeta;
  bolDocument: AppointmentDocumentMeta;
};

export type AppointmentDocumentType = "pod" | "bol";

export type AppointmentDocumentMeta = {
  hasFile: boolean;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
};

export type AppointmentDocumentFile = AppointmentDocumentMeta & {
  data: Buffer;
};

export type ContainerQueryResult = {
  containers: ContainerRecord[];
  total: number;
  allContainers: number;
  involvedCustomers: number;
  pendingPickup: number;
  pickedUp: number;
  page: number;
  pageSize: number;
};

export type DateFilterField = "orderDate" | "etaDate" | "lfdDate" | "pickupDate";
export type EditableContainerDateField = DateFilterField;
export type EditableAppointmentField =
  | "warehousePoint"
  | "isaNumber"
  | "deliveryTime"
  | "palletCount";
export type EditableWarehouseAppointmentField =
  | "appointmentNumber"
  | "deliveryDate"
  | "effectivePallets";
export type EditableWarehouseDetailField = "actualPallets";
export type PickupStatus = "pending" | "picked";

type ContainerRow = {
  source_order_id: string;
  container_number: string;
  customer_id: string | null;
  customer_code: string | null;
  customer_name: string | null;
  order_date: Date | string | null;
  eta_date: Date | string | null;
  lfd_date: Date | string | null;
  pickup_date: Date | string | null;
  operation_mode: string | null;
  destination: string | null;
  warehouse_points: string | null;
  appointments: DeliveryAppointmentRow[] | null;
  warehouse_details: WarehouseDetailRow[] | null;
  appointment_documents: AppointmentDocumentRow[] | null;
  bill_document: ContainerBillDocumentRow | null;
};

type DeliveryAppointmentRow = {
  sourceAppointmentId: string | null;
  warehousePoint: string | null;
  isaNumber: string | null;
  deliveryTime: Date | string | null;
  palletCount: number | string | null;
};

type WarehouseDetailRow = {
  sourceOrderDetailId: string | null;
  deliveryNature: string | null;
  warehousePoint: string | null;
  windowPeriod: string | null;
  volume: string | number | null;
  estimatedPallets: string | number | null;
  volumePercentage: string | number | null;
  warehouseLocation: string | null;
  actualPallets: string | number | null;
  remainingPallets: string | number | null;
  deliveryProgress: string | number | null;
  fba: string | null;
  notes: string | null;
  po: string | null;
  appointments: WarehouseAppointmentRow[] | null;
};

type WarehouseAppointmentRow = {
  sourceOrderDetailId?: string | null;
  sourceAppointmentLineId: string | null;
  sourceAppointmentId: string | null;
  appointmentNumber: string | null;
  deliveryDate: Date | string | null;
  estimatedPallets: string | number | null;
  rejectedPallets: string | number | null;
  effectivePallets: string | number | null;
};

type AppointmentDocumentRow = {
  sourceOrderDetailId: string | null;
  sourceAppointmentLineId: string | null;
  documentType: AppointmentDocumentType | string | null;
  hasFile?: boolean | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: string | number | null;
  uploadedAt: Date | string | null;
};

type ContainerBillDocumentRow = {
  hasFile?: boolean | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: string | number | null;
  uploadedAt: Date | string | null;
};

type CustomerRow = {
  id: string;
  code: string | null;
  name: string;
  container_count: string | number;
};

type CountRow = {
  total: string | number;
  involved_customers: string | number;
  pending_pickup: string | number;
  picked_up: string | number;
};

const sourceDateFilterColumns: Record<DateFilterField, string> = {
  orderDate: "o.order_date",
  etaDate: "o.eta_date",
  lfdDate: "o.lfd_date",
  pickupDate: "o.pickup_date",
};

const appDateFilterColumns: Record<DateFilterField, string> = {
  orderDate:
    "case when pc.manual_order_date_override then pc.manual_order_date else pc.source_order_date end",
  etaDate:
    "case when pc.manual_eta_date_override then pc.manual_eta_date else pc.source_eta_date end",
  lfdDate:
    "case when pc.manual_lfd_date_override then pc.manual_lfd_date else pc.source_lfd_date end",
  pickupDate:
    "case when pc.manual_pickup_date_override then pc.manual_pickup_date else pc.source_pickup_date end",
};

const editableDateColumns: Record<
  EditableContainerDateField,
  { dateColumn: string; overrideColumn: string }
> = {
  orderDate: {
    dateColumn: "manual_order_date",
    overrideColumn: "manual_order_date_override",
  },
  etaDate: {
    dateColumn: "manual_eta_date",
    overrideColumn: "manual_eta_date_override",
  },
  lfdDate: {
    dateColumn: "manual_lfd_date",
    overrideColumn: "manual_lfd_date_override",
  },
  pickupDate: {
    dateColumn: "manual_pickup_date",
    overrideColumn: "manual_pickup_date_override",
  },
};

const appAppointmentColumns: Record<EditableAppointmentField, string> = {
  warehousePoint:
    "case when pda.manual_warehouse_point_override then pda.manual_warehouse_point else pda.source_warehouse_point end",
  isaNumber:
    "case when pda.manual_isa_number_override then pda.manual_isa_number else pda.source_isa_number end",
  deliveryTime:
    "case when pda.manual_delivery_time_override then pda.manual_delivery_time else pda.source_delivery_time end",
  palletCount:
    "case when pda.manual_pallet_count_override then pda.manual_pallet_count else pda.source_pallet_count end",
};

const editableAppointmentColumns: Record<
  EditableAppointmentField,
  { valueColumn: string; overrideColumn: string; cast: string }
> = {
  warehousePoint: {
    valueColumn: "manual_warehouse_point",
    overrideColumn: "manual_warehouse_point_override",
    cast: "text",
  },
  isaNumber: {
    valueColumn: "manual_isa_number",
    overrideColumn: "manual_isa_number_override",
    cast: "text",
  },
  deliveryTime: {
    valueColumn: "manual_delivery_time",
    overrideColumn: "manual_delivery_time_override",
    cast: "timestamptz",
  },
  palletCount: {
    valueColumn: "manual_pallet_count",
    overrideColumn: "manual_pallet_count_override",
    cast: "integer",
  },
};

const appWarehouseAppointmentColumns: Record<
  EditableWarehouseAppointmentField,
  string
> = {
  appointmentNumber:
    "case when pwa.manual_appointment_number_override then pwa.manual_appointment_number else pwa.source_appointment_number end",
  deliveryDate:
    "case when pwa.manual_delivery_date_override then pwa.manual_delivery_date else pwa.source_delivery_date end",
  effectivePallets:
    "case when pwa.manual_effective_pallets_override then pwa.manual_effective_pallets else pwa.source_effective_pallets end",
};

const editableWarehouseAppointmentColumns: Record<
  EditableWarehouseAppointmentField,
  { valueColumn: string; overrideColumn: string; cast: string }
> = {
  appointmentNumber: {
    valueColumn: "manual_appointment_number",
    overrideColumn: "manual_appointment_number_override",
    cast: "text",
  },
  deliveryDate: {
    valueColumn: "manual_delivery_date",
    overrideColumn: "manual_delivery_date_override",
    cast: "timestamptz",
  },
  effectivePallets: {
    valueColumn: "manual_effective_pallets",
    overrideColumn: "manual_effective_pallets_override",
    cast: "integer",
  },
};

const appWarehouseDetailColumns: Record<EditableWarehouseDetailField, string> =
  {
    actualPallets:
      "case when pwd.manual_actual_pallets_override then pwd.manual_actual_pallets else pwd.source_actual_pallets end",
  };

const editableWarehouseDetailColumns: Record<
  EditableWarehouseDetailField,
  { valueColumn: string; overrideColumn: string; cast: string }
> = {
  actualPallets: {
    valueColumn: "manual_actual_pallets",
    overrideColumn: "manual_actual_pallets_override",
    cast: "integer",
  },
};

const baseFrom = `
  from public.orders o
  left join public.customers c
    on c.id = o.customer_id
  left join public.locations order_location
    on order_location.location_id = o.delivery_location_id
  left join lateral (
    select string_agg(
      distinct coalesce(
        nullif(
          case
            when detail_location.location_code is not null
              and detail_location.name is not null
              and detail_location.location_code <> detail_location.name
              then detail_location.location_code || ' - ' || detail_location.name
            else coalesce(detail_location.location_code, detail_location.name)
          end,
          ''
        ),
        nullif(od.private_warehouse_info, ''),
        od.delivery_location_id::text
      ),
      ', '
      order by coalesce(
        nullif(
          case
            when detail_location.location_code is not null
              and detail_location.name is not null
              and detail_location.location_code <> detail_location.name
              then detail_location.location_code || ' - ' || detail_location.name
            else coalesce(detail_location.location_code, detail_location.name)
          end,
          ''
        ),
        nullif(od.private_warehouse_info, ''),
        od.delivery_location_id::text
      )
    ) as warehouse_points
    from public.order_detail od
    left join public.locations detail_location
      on detail_location.location_id = od.delivery_location_id
    where od.order_id = o.order_id
  ) detail_points on true
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'sourceAppointmentId', appointment_rows.appointment_id::text,
          'warehousePoint', appointment_rows.warehouse_point,
          'isaNumber', appointment_rows.reference_number,
          'deliveryTime', appointment_rows.confirmed_start,
          'palletCount', appointment_rows.pallet_count
        )
        order by
          appointment_rows.warehouse_point asc,
          appointment_rows.confirmed_start asc nulls last,
          appointment_rows.reference_number asc nulls last
      ),
      '[]'::jsonb
    ) as appointments
    from (
      select
        coalesce(
          nullif(
            case
              when appointment_location.location_code is not null
                and appointment_location.name is not null
                and appointment_location.location_code <> appointment_location.name
                then appointment_location.location_code || ' - ' || appointment_location.name
              else coalesce(appointment_location.location_code, appointment_location.name)
            end,
            ''
          ),
          detail_match.warehouse_point,
          da.location_id::text,
          '未设置仓点'
        ) as warehouse_point,
        da.appointment_id,
        da.reference_number,
        da.confirmed_start,
        coalesce(
          nullif(sum(coalesce(adl_all.estimated_pallets, 0)), 0)::int,
          da.total_pallets
        ) as pallet_count
      from oms.delivery_appointments da
      left join public.locations appointment_location
        on appointment_location.location_id = da.location_id
      left join oms.appointment_detail_lines adl_all
        on adl_all.appointment_id = da.appointment_id
      left join lateral (
        select coalesce(
          nullif(
            case
              when detail_location.location_code is not null
                and detail_location.name is not null
                and detail_location.location_code <> detail_location.name
                then detail_location.location_code || ' - ' || detail_location.name
              else coalesce(detail_location.location_code, detail_location.name)
            end,
            ''
          ),
          nullif(od.private_warehouse_info, ''),
          od.delivery_location_id::text
        ) as warehouse_point
        from oms.appointment_detail_lines adl_match
        join public.order_detail od
          on od.id = adl_match.order_detail_id
        left join public.locations detail_location
          on detail_location.location_id = od.delivery_location_id
        where adl_match.appointment_id = da.appointment_id
          and od.order_id = o.order_id
        order by od.id
        limit 1
      ) detail_match on true
      where da.appointment_id is not null
        and (
          da.order_id = o.order_id
          or exists (
            select 1
            from oms.appointment_detail_lines adl_exists
            join public.order_detail od_exists
              on od_exists.id = adl_exists.order_detail_id
            where adl_exists.appointment_id = da.appointment_id
              and od_exists.order_id = o.order_id
          )
        )
      group by
        appointment_location.location_code,
        appointment_location.name,
        detail_match.warehouse_point,
        da.location_id,
        da.appointment_id,
        da.reference_number,
        da.confirmed_start,
        da.total_pallets
    ) appointment_rows
  ) appointment_points on true
  where o.order_number is not null
    and btrim(o.order_number) <> ''
`;

export async function getCustomers(): Promise<CustomerOption[]> {
  return withAppReadOnlyTransaction(async (client) => {
    const result = await client.query<CustomerRow>(`
      select
        c.source_customer_id as id,
        nullif(c.code, '') as code,
        coalesce(nullif(c.name, ''), c.code, '未命名客户') as name,
        count(pc.source_order_id)::int as container_count
      from public.portal_customers c
      left join public.portal_containers pc
        on pc.source_customer_id = c.source_customer_id
        and pc.source_active = true
      where c.source_active = true
      group by c.source_customer_id, c.code, c.name
      order by c.code asc nulls last, c.name asc
    `);

    return rows(result).map((customer) => ({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      containerCount: Number(customer.container_count),
    }));
  });
}

export async function getContainers({
  customerId,
  operationMode,
  search,
  dateField,
  dateFrom,
  dateTo,
  pickupStatus,
  page = 1,
  pageSize = 100,
}: {
  customerId?: string | null;
  operationMode?: string | null;
  search?: string | null;
  dateField?: DateFilterField | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  pickupStatus?: PickupStatus | null;
  page?: number;
  pageSize?: number;
}): Promise<ContainerQueryResult> {
  const params: string[] = [];
  const baseFilters: string[] = ["pc.source_active = true"];
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(200, Math.max(25, Math.floor(pageSize)));
  const offset = (safePage - 1) * safePageSize;

  if (customerId) {
    params.push(customerId);
    baseFilters.push(`pc.source_customer_id = $${params.length}`);
  }

  if (operationMode === "direct_delivery" || operationMode === "unload") {
    params.push(operationMode);
    baseFilters.push(
      `coalesce(pc.manual_operation_mode, pc.source_operation_mode) = $${params.length}`,
    );
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    baseFilters.push(`(
      pc.container_number ilike $${params.length}
      or coalesce(pc.manual_warehouse_points, pc.source_warehouse_points, '') ilike $${params.length}
      or coalesce(pc.manual_destination, pc.source_destination, '') ilike $${params.length}
      or coalesce(c.code, '') ilike $${params.length}
      or coalesce(c.name, '') ilike $${params.length}
      or exists (
        select 1
        from public.portal_warehouse_details pwd_search
        where pwd_search.source_order_id = pc.source_order_id
          and pwd_search.source_active = true
          and (
            coalesce(pwd_search.source_warehouse_point, '') ilike $${params.length}
            or coalesce(pwd_search.source_window_period, '') ilike $${params.length}
            or coalesce(pwd_search.source_warehouse_location, '') ilike $${params.length}
            or coalesce(pwd_search.source_fba, '') ilike $${params.length}
            or coalesce(pwd_search.source_notes, '') ilike $${params.length}
            or coalesce(pwd_search.source_po, '') ilike $${params.length}
          )
      )
      or exists (
        select 1
        from public.portal_warehouse_appointments pwa_search
        where pwa_search.source_order_id = pc.source_order_id
          and pwa_search.source_active = true
          and coalesce(pwa_search.manual_appointment_number, pwa_search.source_appointment_number, '') ilike $${params.length}
      )
    )`);
  }

  if (dateField && appDateFilterColumns[dateField]) {
    const dateColumn = appDateFilterColumns[dateField];

    if (isDateInput(dateFrom)) {
      params.push(dateFrom);
      baseFilters.push(`${dateColumn}::date >= $${params.length}::date`);
    }

    if (isDateInput(dateTo)) {
      params.push(dateTo);
      baseFilters.push(`${dateColumn}::date <= $${params.length}::date`);
    }
  }

  const dataFilters = [...baseFilters];
  if (pickupStatus === "pending") {
    dataFilters.push(`${appDateFilterColumns.pickupDate} is null`);
  } else if (pickupStatus === "picked") {
    dataFilters.push(`${appDateFilterColumns.pickupDate} is not null`);
  }

  return withAppReadOnlyTransaction(async (client) => {
    const countWhereClause = baseFilters.length
      ? `where ${baseFilters.join(" and ")}`
      : "";
    const dataWhereClause = dataFilters.length
      ? `where ${dataFilters.join(" and ")}`
      : "";

    const countResult = await client.query<CountRow>(
      `
        select
          count(*)::int as total,
          count(distinct pc.source_customer_id)::int as involved_customers,
          count(*) filter (
            where ${appDateFilterColumns.pickupDate} is null
          )::int as pending_pickup,
          count(*) filter (
            where ${appDateFilterColumns.pickupDate} is not null
          )::int as picked_up
        from public.portal_containers pc
        left join public.portal_customers c
          on c.source_customer_id = pc.source_customer_id
        ${countWhereClause}
      `,
      params,
    );

    const dataCountResult = await client.query<{ total: string | number }>(
      `
        select count(*)::int as total
        from public.portal_containers pc
        left join public.portal_customers c
          on c.source_customer_id = pc.source_customer_id
        ${dataWhereClause}
      `,
      params,
    );

    const pagedParams = [...params, safePageSize, offset];
    const result = await client.query<ContainerRow>(
      `
        select
          pc.source_order_id,
          pc.container_number,
          pc.source_customer_id as customer_id,
          nullif(c.code, '') as customer_code,
          coalesce(nullif(c.name, ''), '未分配客户') as customer_name,
          ${appDateFilterColumns.orderDate} as order_date,
          ${appDateFilterColumns.etaDate} as eta_date,
          ${appDateFilterColumns.lfdDate} as lfd_date,
          ${appDateFilterColumns.pickupDate} as pickup_date,
          coalesce(pc.manual_operation_mode, pc.source_operation_mode) as operation_mode,
          coalesce(pc.manual_destination, pc.source_destination) as destination,
          coalesce(pc.manual_warehouse_points, pc.source_warehouse_points) as warehouse_points,
          coalesce(appointment_points.appointments, '[]'::jsonb) as appointments,
          coalesce(warehouse_detail_points.warehouse_details, '[]'::jsonb) as warehouse_details,
          coalesce(document_points.appointment_documents, '[]'::jsonb) as appointment_documents,
          bill_document.bill_document as bill_document
        from public.portal_containers pc
        left join public.portal_customers c
          on c.source_customer_id = pc.source_customer_id
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'sourceAppointmentId', pda.source_appointment_id,
              'warehousePoint', ${appAppointmentColumns.warehousePoint},
              'isaNumber', ${appAppointmentColumns.isaNumber},
              'deliveryTime', ${appAppointmentColumns.deliveryTime},
              'palletCount', ${appAppointmentColumns.palletCount}
            )
            order by
              ${appAppointmentColumns.warehousePoint} asc,
              ${appAppointmentColumns.deliveryTime} asc nulls last,
              ${appAppointmentColumns.isaNumber} asc nulls last
          ) as appointments
          from public.portal_delivery_appointments pda
          where pda.source_order_id = pc.source_order_id
            and pda.source_active = true
        ) appointment_points on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'sourceOrderDetailId', pwd.source_order_detail_id,
              'deliveryNature', pwd.source_delivery_nature,
              'warehousePoint', pwd.source_warehouse_point,
              'windowPeriod', pwd.source_window_period,
              'volume', pwd.source_volume,
              'estimatedPallets', pwd.source_estimated_pallets,
              'volumePercentage', pwd.source_volume_percentage,
              'warehouseLocation', pwd.source_warehouse_location,
              'actualPallets', ${appWarehouseDetailColumns.actualPallets},
              'remainingPallets', pwd.source_remaining_pallets,
              'deliveryProgress', pwd.source_delivery_progress,
              'fba', pwd.source_fba,
              'notes', pwd.source_notes,
              'po', pwd.source_po,
              'appointments', coalesce(warehouse_appointments.appointments, '[]'::jsonb)
            )
            order by
              pwd.source_warehouse_point asc nulls last,
              pwd.source_order_detail_id asc
          ) as warehouse_details
          from public.portal_warehouse_details pwd
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'sourceOrderDetailId', pwa.source_order_detail_id,
                'sourceAppointmentLineId', pwa.source_appointment_line_id,
                'sourceAppointmentId', pwa.source_appointment_id,
                'appointmentNumber', ${appWarehouseAppointmentColumns.appointmentNumber},
                'deliveryDate', ${appWarehouseAppointmentColumns.deliveryDate},
                'estimatedPallets', pwa.source_estimated_pallets,
                'rejectedPallets', pwa.source_rejected_pallets,
                'effectivePallets', ${appWarehouseAppointmentColumns.effectivePallets}
              )
              order by
                ${appWarehouseAppointmentColumns.deliveryDate} asc nulls last,
                ${appWarehouseAppointmentColumns.appointmentNumber} asc nulls last,
                pwa.source_appointment_line_id asc
            ) as appointments
            from public.portal_warehouse_appointments pwa
            where pwa.source_order_id = pc.source_order_id
              and pwa.source_order_detail_id = pwd.source_order_detail_id
              and pwa.source_active = true
          ) warehouse_appointments on true
          where pwd.source_order_id = pc.source_order_id
            and pwd.source_active = true
        ) warehouse_detail_points on true
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'sourceOrderDetailId', pwd_doc.source_order_detail_id,
              'sourceAppointmentLineId', pwd_doc.source_appointment_line_id,
              'documentType', pwd_doc.document_type,
              'hasFile', pwd_doc.file_data is not null,
              'fileName', pwd_doc.file_name,
              'mimeType', pwd_doc.mime_type,
              'fileSize', pwd_doc.file_size,
              'uploadedAt', pwd_doc.uploaded_at
            )
            order by
              pwd_doc.source_order_detail_id asc,
              pwd_doc.source_appointment_line_id asc,
              pwd_doc.document_type asc
          ) as appointment_documents
          from public.portal_warehouse_appointment_documents pwd_doc
          where pwd_doc.source_order_id = pc.source_order_id
        ) document_points on true
        left join lateral (
          select jsonb_build_object(
            'hasFile', pcb.file_data is not null,
            'fileName', pcb.file_name,
            'mimeType', pcb.mime_type,
            'fileSize', pcb.file_size,
            'uploadedAt', pcb.uploaded_at
          ) as bill_document
          from public.portal_container_bills pcb
          where pcb.source_order_id = pc.source_order_id
        ) bill_document on true
        ${dataWhereClause}
        order by
          ${appDateFilterColumns.orderDate} desc nulls last,
          ${appDateFilterColumns.etaDate} desc nulls last,
          pc.container_number asc
        limit $${pagedParams.length - 1}
        offset $${pagedParams.length}
      `,
      pagedParams,
    );

    return {
      containers: rows(result).map(toContainerRecord),
      total: Number(rows(dataCountResult)[0]?.total ?? 0),
      allContainers: Number(rows(countResult)[0]?.total ?? 0),
      involvedCustomers: Number(rows(countResult)[0]?.involved_customers ?? 0),
      pendingPickup: Number(rows(countResult)[0]?.pending_pickup ?? 0),
      pickedUp: Number(rows(countResult)[0]?.picked_up ?? 0),
      page: safePage,
      pageSize: safePageSize,
    };
  });
}

export async function updateContainerDate({
  customerId,
  sourceOrderId,
  field,
  value,
}: {
  customerId: string;
  sourceOrderId: string;
  field: EditableContainerDateField;
  value: string | null;
}): Promise<Pick<ContainerRecord, "orderDate" | "etaDate" | "lfdDate" | "pickupDate"> | null> {
  const column = editableDateColumns[field];
  const normalizedValue = normalizeEditableDate(value);

  return withAppTransaction(async (client) => {
    const result = await client.query<{
      order_date: Date | string | null;
      eta_date: Date | string | null;
      lfd_date: Date | string | null;
      pickup_date: Date | string | null;
    }>(
      `
        update public.portal_containers pc
        set ${column.dateColumn} = $3::date,
            ${column.overrideColumn} = true,
            updated_at = now()
        where source_order_id = $1
          and source_customer_id = $2
          and source_active = true
        returning
          ${appDateFilterColumns.orderDate} as order_date,
          ${appDateFilterColumns.etaDate} as eta_date,
          ${appDateFilterColumns.lfdDate} as lfd_date,
          ${appDateFilterColumns.pickupDate} as pickup_date
      `,
      [sourceOrderId, customerId, normalizedValue],
    );
    const updated = rows(result)[0];

    if (!updated) return null;

    return {
      orderDate: formatDate(updated.order_date),
      etaDate: formatDate(updated.eta_date),
      lfdDate: formatDate(updated.lfd_date),
      pickupDate: formatDate(updated.pickup_date),
    };
  });
}

export async function updateAppointmentDetail({
  customerId,
  sourceOrderId,
  sourceAppointmentId,
  field,
  value,
}: {
  customerId: string;
  sourceOrderId: string;
  sourceAppointmentId: string;
  field: EditableAppointmentField;
  value: string | null;
}): Promise<DeliveryAppointment | null> {
  const column = editableAppointmentColumns[field];
  const normalizedValue = normalizeAppointmentValue(field, value);

  return withAppTransaction(async (client) => {
    const result = await client.query<DeliveryAppointmentRow>(
      `
        update public.portal_delivery_appointments pda
        set ${column.valueColumn} = $4::${column.cast},
            ${column.overrideColumn} = true,
            updated_at = now()
        from public.portal_containers pc
        where pda.source_order_id = pc.source_order_id
          and pda.source_order_id = $1
          and pda.source_appointment_id = $2
          and pda.source_active = true
          and pc.source_customer_id = $3
          and pc.source_active = true
        returning
          pda.source_appointment_id as "sourceAppointmentId",
          ${appAppointmentColumns.warehousePoint} as "warehousePoint",
          ${appAppointmentColumns.isaNumber} as "isaNumber",
          ${appAppointmentColumns.deliveryTime} as "deliveryTime",
          ${appAppointmentColumns.palletCount} as "palletCount"
      `,
      [sourceOrderId, sourceAppointmentId, customerId, normalizedValue],
    );
    const updated = rows(result)[0];

    if (!updated) return null;

    return toDeliveryAppointment(updated);
  });
}

export async function updateWarehouseDetail({
  customerId,
  sourceOrderId,
  sourceOrderDetailId,
  field,
  value,
}: {
  customerId: string;
  sourceOrderId: string;
  sourceOrderDetailId: string;
  field: EditableWarehouseDetailField;
  value: string | null;
}): Promise<Pick<WarehouseDetail, "sourceOrderDetailId" | "actualPallets"> | null> {
  const column = editableWarehouseDetailColumns[field];
  const normalizedValue = normalizeWarehouseDetailValue(field, value);
  const sourceOrderDetailIds = sourceOrderDetailId
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!sourceOrderDetailIds.length) return null;

  return withAppTransaction(async (client) => {
    let updatedRows = 0;

    for (const [index, detailId] of sourceOrderDetailIds.entries()) {
      const valueForRow =
        sourceOrderDetailIds.length > 1 && index > 0 && normalizedValue !== null
          ? 0
          : normalizedValue;
      const result = await client.query(
        `
          update public.portal_warehouse_details pwd
          set ${column.valueColumn} = $4::${column.cast},
              ${column.overrideColumn} = true,
              updated_at = now()
          from public.portal_containers pc
          where pwd.source_order_id = pc.source_order_id
            and pwd.source_order_id = $1
            and pwd.source_order_detail_id = $2
            and pc.source_customer_id = $3
            and pwd.source_active = true
            and pc.source_active = true
        `,
        [sourceOrderId, detailId, customerId, valueForRow],
      );
      updatedRows += result.rowCount ?? 0;
    }

    if (!updatedRows) return null;

    return {
      sourceOrderDetailId,
      actualPallets: normalizedValue,
    };
  });
}

export async function updateWarehouseAppointmentDetail({
  customerId,
  sourceOrderId,
  sourceOrderDetailId,
  sourceAppointmentLineId,
  field,
  value,
}: {
  customerId: string;
  sourceOrderId: string;
  sourceOrderDetailId: string;
  sourceAppointmentLineId: string;
  field: EditableWarehouseAppointmentField;
  value: string | null;
}): Promise<WarehouseAppointment | null> {
  const column = editableWarehouseAppointmentColumns[field];
  const normalizedValue = normalizeWarehouseAppointmentValue(field, value);

  return withAppTransaction(async (client) => {
    const result = await client.query<WarehouseAppointmentRow>(
      `
        update public.portal_warehouse_appointments pwa
        set ${column.valueColumn} = $5::${column.cast},
            ${column.overrideColumn} = true,
            updated_at = now()
        from public.portal_containers pc
        where pwa.source_order_id = pc.source_order_id
          and pwa.source_order_id = $1
          and pwa.source_order_detail_id = $2
          and pwa.source_appointment_line_id = $3
          and pc.source_customer_id = $4
          and pwa.source_active = true
          and pc.source_active = true
        returning
          pwa.source_appointment_line_id as "sourceAppointmentLineId",
          pwa.source_appointment_id as "sourceAppointmentId",
          ${appWarehouseAppointmentColumns.appointmentNumber} as "appointmentNumber",
          ${appWarehouseAppointmentColumns.deliveryDate} as "deliveryDate",
          pwa.source_estimated_pallets as "estimatedPallets",
          pwa.source_rejected_pallets as "rejectedPallets",
          ${appWarehouseAppointmentColumns.effectivePallets} as "effectivePallets"
      `,
      [
        sourceOrderId,
        sourceOrderDetailId,
        sourceAppointmentLineId,
        customerId,
        normalizedValue,
      ],
    );
    const updated = rows(result)[0];

    if (!updated) return null;

    return toWarehouseAppointment(updated);
  });
}

export async function saveWarehouseAppointmentDocument({
  customerId,
  sourceOrderId,
  sourceOrderDetailId,
  sourceAppointmentLineId,
  documentType,
  fileName,
  mimeType,
  fileSize,
  data,
}: {
  customerId: string;
  sourceOrderId: string;
  sourceOrderDetailId: string;
  sourceAppointmentLineId: string;
  documentType: AppointmentDocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
}): Promise<AppointmentDocumentMeta | null> {
  return withAppTransaction(async (client) => {
    const result = await client.query<{
      hasFile: boolean;
      fileName: string | null;
      mimeType: string | null;
      fileSize: string | number | null;
      uploadedAt: Date | string | null;
    }>(
      `
        insert into public.portal_warehouse_appointment_documents (
          source_order_id,
          source_order_detail_id,
          source_appointment_line_id,
          document_type,
          file_name,
          mime_type,
          file_size,
          file_data,
          uploaded_at,
          updated_at
        )
        select
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          now(),
          now()
        where exists (
          select 1
          from public.portal_containers pc
          join public.portal_warehouse_appointments pwa
            on pwa.source_order_id = pc.source_order_id
           and pwa.source_order_detail_id = $2
           and pwa.source_appointment_line_id = $3
           and pwa.source_active = true
          where pc.source_order_id = $1
            and pc.source_customer_id = $9
            and pc.source_active = true
        )
        on conflict (
          source_order_id,
          source_order_detail_id,
          source_appointment_line_id,
          document_type
        )
        do update set
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          file_size = excluded.file_size,
          file_data = excluded.file_data,
          uploaded_at = now(),
          updated_at = now()
        returning
          true as "hasFile",
          file_name as "fileName",
          mime_type as "mimeType",
          file_size as "fileSize",
          uploaded_at as "uploadedAt"
      `,
      [
        sourceOrderId,
        sourceOrderDetailId,
        sourceAppointmentLineId,
        documentType,
        fileName,
        mimeType,
        fileSize,
        data,
        customerId,
      ],
    );
    const document = rows(result)[0];

    if (!document) return null;

    return toAppointmentDocumentMeta({
      sourceOrderDetailId,
      sourceAppointmentLineId,
      documentType,
      hasFile: document.hasFile,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      uploadedAt: document.uploadedAt,
    });
  });
}

export async function getWarehouseAppointmentDocument({
  customerId,
  sourceOrderId,
  sourceOrderDetailId,
  sourceAppointmentLineId,
  documentType,
}: {
  customerId: string;
  sourceOrderId: string;
  sourceOrderDetailId: string;
  sourceAppointmentLineId: string;
  documentType: AppointmentDocumentType;
}): Promise<AppointmentDocumentFile | null> {
  return withAppReadOnlyTransaction(async (client) => {
    const result = await client.query<{
      fileName: string | null;
      mimeType: string | null;
      fileSize: string | number | null;
      uploadedAt: Date | string | null;
      data: Buffer;
    }>(
      `
        select
          pwd.file_name as "fileName",
          pwd.mime_type as "mimeType",
          pwd.file_size as "fileSize",
          pwd.uploaded_at as "uploadedAt",
          pwd.file_data as data
        from public.portal_warehouse_appointment_documents pwd
        join public.portal_containers pc
          on pc.source_order_id = pwd.source_order_id
        join public.portal_warehouse_appointments pwa
          on pwa.source_order_id = pwd.source_order_id
         and pwa.source_order_detail_id = pwd.source_order_detail_id
         and pwa.source_appointment_line_id = pwd.source_appointment_line_id
         and pwa.source_active = true
        where pwd.source_order_id = $1
          and pwd.source_order_detail_id = $2
          and pwd.source_appointment_line_id = $3
          and pwd.document_type = $4
          and pc.source_customer_id = $5
          and pc.source_active = true
        limit 1
      `,
      [
        sourceOrderId,
        sourceOrderDetailId,
        sourceAppointmentLineId,
        documentType,
        customerId,
      ],
    );
    const document = rows(result)[0];

    if (!document) return null;

    return {
      hasFile: true,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: toNullableNumber(document.fileSize),
      uploadedAt: formatDateTime(document.uploadedAt),
      data: document.data,
    };
  });
}

export async function saveContainerBillDocument({
  customerId,
  sourceOrderId,
  fileName,
  mimeType,
  fileSize,
  data,
}: {
  customerId: string;
  sourceOrderId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
}): Promise<AppointmentDocumentMeta | null> {
  return withAppTransaction(async (client) => {
    const result = await client.query<ContainerBillDocumentRow>(
      `
        insert into public.portal_container_bills (
          source_order_id,
          file_name,
          mime_type,
          file_size,
          file_data,
          uploaded_at,
          updated_at
        )
        select
          $1,
          $2,
          $3,
          $4,
          $5,
          now(),
          now()
        where exists (
          select 1
          from public.portal_containers pc
          where pc.source_order_id = $1
            and pc.source_customer_id = $6
            and pc.source_active = true
        )
        on conflict (source_order_id)
        do update set
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          file_size = excluded.file_size,
          file_data = excluded.file_data,
          uploaded_at = now(),
          updated_at = now()
        returning
          true as "hasFile",
          file_name as "fileName",
          mime_type as "mimeType",
          file_size as "fileSize",
          uploaded_at as "uploadedAt"
      `,
      [sourceOrderId, fileName, mimeType, fileSize, data, customerId],
    );
    const document = rows(result)[0];

    if (!document) return null;

    return toContainerBillDocumentMeta(document);
  });
}

export async function getContainerBillDocument({
  customerId,
  sourceOrderId,
}: {
  customerId: string;
  sourceOrderId: string;
}): Promise<AppointmentDocumentFile | null> {
  return withAppReadOnlyTransaction(async (client) => {
    const result = await client.query<
      ContainerBillDocumentRow & { data: Buffer }
    >(
      `
        select
          true as "hasFile",
          pcb.file_name as "fileName",
          pcb.mime_type as "mimeType",
          pcb.file_size as "fileSize",
          pcb.uploaded_at as "uploadedAt",
          pcb.file_data as data
        from public.portal_container_bills pcb
        join public.portal_containers pc
          on pc.source_order_id = pcb.source_order_id
        where pcb.source_order_id = $1
          and pc.source_customer_id = $2
          and pc.source_active = true
        limit 1
      `,
      [sourceOrderId, customerId],
    );
    const document = rows(result)[0];

    if (!document) return null;

    return {
      ...toContainerBillDocumentMeta(document),
      hasFile: true,
      data: document.data,
    };
  });
}

export async function getSourceCustomers(): Promise<CustomerOption[]> {
  return withSourceReadOnlyTransaction(async (client) => {
    const result = await client.query<CustomerRow>(`
      select
        c.id::text as id,
        nullif(c.code, '') as code,
        coalesce(nullif(c.name, ''), '未命名客户') as name,
        count(o.order_id)::int as container_count
      ${baseFrom}
        and c.id is not null
      group by c.id, c.code, c.name
      order by c.code asc nulls last, c.name asc
    `);

    return rows(result).map((customer) => ({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      containerCount: Number(customer.container_count),
    }));
  });
}

export async function getSourceContainers({
  customerId,
  operationMode,
  search,
  dateField,
  dateFrom,
  dateTo,
  pickupStatus,
  page = 1,
  pageSize = 100,
}: {
  customerId?: string | null;
  operationMode?: string | null;
  search?: string | null;
  dateField?: DateFilterField | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  pickupStatus?: PickupStatus | null;
  page?: number;
  pageSize?: number;
}): Promise<ContainerQueryResult> {
  const params: string[] = [];
  const baseFilters: string[] = [];
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(200, Math.max(25, Math.floor(pageSize)));
  const offset = (safePage - 1) * safePageSize;

  if (customerId) {
    params.push(customerId);
    baseFilters.push(`c.id::text = $${params.length}`);
  }

  if (operationMode === "direct_delivery" || operationMode === "unload") {
    params.push(operationMode);
    baseFilters.push(`o.operation_mode = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    baseFilters.push(`(
      o.order_number ilike $${params.length}
      or coalesce(detail_points.warehouse_points, '') ilike $${params.length}
      or coalesce(o.delivery_location, '') ilike $${params.length}
      or coalesce(order_location.location_code, '') ilike $${params.length}
      or coalesce(order_location.name, '') ilike $${params.length}
    )`);
  }

  if (dateField && sourceDateFilterColumns[dateField]) {
    const dateColumn = sourceDateFilterColumns[dateField];

    if (isDateInput(dateFrom)) {
      params.push(dateFrom);
      baseFilters.push(`${dateColumn}::date >= $${params.length}::date`);
    }

    if (isDateInput(dateTo)) {
      params.push(dateTo);
      baseFilters.push(`${dateColumn}::date <= $${params.length}::date`);
    }
  }

  const dataFilters = [...baseFilters];
  if (pickupStatus === "pending") {
    dataFilters.push("o.pickup_date is null");
  } else if (pickupStatus === "picked") {
    dataFilters.push("o.pickup_date is not null");
  }

  return withSourceReadOnlyTransaction(async (client) => {
    const countWhereClause = baseFilters.length
      ? `and ${baseFilters.join(" and ")}`
      : "";
    const dataWhereClause = dataFilters.length
      ? `and ${dataFilters.join(" and ")}`
      : "";
    const countResult = await client.query<CountRow>(
      `
        select
          count(*)::int as total,
          count(distinct c.id)::int as involved_customers,
          count(*) filter (where o.pickup_date is null)::int as pending_pickup,
          count(*) filter (where o.pickup_date is not null)::int as picked_up
        ${baseFrom}
          ${countWhereClause}
      `,
      params,
    );

    const dataCountResult = await client.query<{ total: string | number }>(
      `
        select count(*)::int as total
        ${baseFrom}
          ${dataWhereClause}
      `,
      params,
    );

    const pagedParams = [...params, safePageSize, offset];
    const result = await client.query<ContainerRow>(
      `
        select
          o.order_id::text as source_order_id,
          o.order_number as container_number,
          c.id::text as customer_id,
          nullif(c.code, '') as customer_code,
          coalesce(nullif(c.name, ''), '未分配客户') as customer_name,
          o.order_date,
          o.eta_date,
          o.lfd_date,
          o.pickup_date,
          o.operation_mode,
          coalesce(
            nullif(
              case
                when order_location.location_code is not null
                  and order_location.name is not null
                  and order_location.location_code <> order_location.name
                  then order_location.location_code || ' - ' || order_location.name
                else coalesce(order_location.location_code, order_location.name)
              end,
              ''
            ),
            nullif(o.delivery_location, '')
          ) as destination,
          detail_points.warehouse_points,
          appointment_points.appointments,
          null::jsonb as warehouse_details,
          null::jsonb as appointment_documents,
          null::jsonb as bill_document
        ${baseFrom}
          ${dataWhereClause}
        order by
          o.order_date desc nulls last,
          o.eta_date desc nulls last,
          o.order_number asc
        limit $${pagedParams.length - 1}
        offset $${pagedParams.length}
      `,
      pagedParams,
    );

    return {
      containers: rows(result).map(toContainerRecord),
      total: Number(rows(dataCountResult)[0]?.total ?? 0),
      allContainers: Number(rows(countResult)[0]?.total ?? 0),
      involvedCustomers: Number(rows(countResult)[0]?.involved_customers ?? 0),
      pendingPickup: Number(rows(countResult)[0]?.pending_pickup ?? 0),
      pickedUp: Number(rows(countResult)[0]?.picked_up ?? 0),
      page: safePage,
      pageSize: safePageSize,
    };
  });
}

function toContainerRecord(row: ContainerRow): ContainerRecord {
  const appointments = (row.appointments ?? []).map(toDeliveryAppointment);
  const appointmentDocuments = buildAppointmentDocumentMap(
    row.appointment_documents ?? [],
  );
  const warehouseDetails = buildWarehouseDetails(
    (row.warehouse_details ?? []).map(toWarehouseDetail),
    appointments,
    appointmentDocuments,
  );

  return {
    sourceOrderId: row.source_order_id,
    containerNumber: row.container_number,
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name ?? "未分配客户",
    orderDate: formatDate(row.order_date),
    etaDate: formatDate(row.eta_date),
    lfdDate: formatDate(row.lfd_date),
    pickupDate: formatDate(row.pickup_date),
    operationMode: row.operation_mode,
    operationModeLabel: formatOperationMode(row.operation_mode),
    destination: row.destination,
    warehousePoints: row.warehouse_points,
    appointments,
    warehouseDetails,
    billDocument: toContainerBillDocumentMeta(row.bill_document),
  };
}

function toDeliveryAppointment(
  appointment: DeliveryAppointmentRow,
): DeliveryAppointment {
  return {
    sourceAppointmentId: appointment.sourceAppointmentId ?? "",
    warehousePoint: appointment.warehousePoint ?? "",
    isaNumber: appointment.isaNumber,
    deliveryTime: formatDateTime(appointment.deliveryTime),
    palletCount:
      appointment.palletCount === null ? null : Number(appointment.palletCount),
  };
}

function toWarehouseDetail(detail: WarehouseDetailRow): WarehouseDetail {
  return {
    sourceOrderDetailId: detail.sourceOrderDetailId ?? "",
    deliveryNature: detail.deliveryNature,
    warehousePoint: detail.warehousePoint ?? "未设置仓点",
    windowPeriod: detail.windowPeriod,
    volume: formatDecimal(detail.volume),
    estimatedPallets: toNullableNumber(detail.estimatedPallets),
    volumePercentage: formatDecimal(detail.volumePercentage),
    warehouseLocation: detail.warehouseLocation,
    actualPallets: toNullableNumber(detail.actualPallets),
    remainingPallets: toNullableNumber(detail.remainingPallets),
    deliveryProgress: formatDecimal(detail.deliveryProgress),
    fba: detail.fba,
    notes: detail.notes,
    po: detail.po,
    appointments: (detail.appointments ?? []).map(toWarehouseAppointment),
  };
}

function toWarehouseAppointment(
  appointment: WarehouseAppointmentRow,
): WarehouseAppointment {
  return {
    sourceOrderDetailId: appointment.sourceOrderDetailId ?? "",
    sourceAppointmentLineId: appointment.sourceAppointmentLineId ?? "",
    sourceAppointmentId: appointment.sourceAppointmentId,
    appointmentNumber: appointment.appointmentNumber,
    deliveryDate: formatDate(appointment.deliveryDate),
    estimatedPallets: toNullableNumber(appointment.estimatedPallets),
    rejectedPallets: toNullableNumber(appointment.rejectedPallets),
    effectivePallets: toNullableNumber(appointment.effectivePallets),
    podDocument: emptyAppointmentDocument(),
    bolDocument: emptyAppointmentDocument(),
  };
}

function buildAppointmentDocumentMap(documents: AppointmentDocumentRow[]) {
  const documentMap = new Map<string, AppointmentDocumentMeta>();

  for (const document of documents) {
    if (
      !document.sourceOrderDetailId ||
      !document.sourceAppointmentLineId ||
      (document.documentType !== "pod" && document.documentType !== "bol")
    ) {
      continue;
    }

    documentMap.set(
      getAppointmentDocumentMapKey(
        document.sourceOrderDetailId,
        document.sourceAppointmentLineId,
        document.documentType,
      ),
      toAppointmentDocumentMeta(document),
    );
  }

  return documentMap;
}

function buildWarehouseDetails(
  details: WarehouseDetail[],
  appointments: DeliveryAppointment[],
  documentMap: Map<string, AppointmentDocumentMeta>,
): WarehouseDetail[] {
  const appointmentById = new Map(
    appointments.map((appointment) => [
      appointment.sourceAppointmentId,
      appointment,
    ]),
  );
  const groupedDetails = new Map<string, WarehouseDetail>();
  const existingAppointmentIds = new Set<string>();

  for (const detail of details) {
    const detailAppointments = detail.appointments.map((appointment) => {
      if (appointment.sourceAppointmentId) {
        existingAppointmentIds.add(appointment.sourceAppointmentId);
      }
      return attachAppointmentDocuments(
        detail.sourceOrderDetailId,
        appointment,
        documentMap,
      );
    });
    const fallbackPoint = detailAppointments
      .map((appointment) =>
        appointment.sourceAppointmentId
          ? appointmentById.get(appointment.sourceAppointmentId)?.warehousePoint
          : null,
      )
      .find((warehousePoint) => isMeaningfulWarehousePoint(warehousePoint));
    const warehousePoint = isMeaningfulWarehousePoint(detail.warehousePoint)
      ? detail.warehousePoint
      : fallbackPoint || "未设置仓点";
    const key = warehousePoint.toLowerCase();
    const existing = groupedDetails.get(key);
    const normalizedDetail = {
      ...detail,
      warehousePoint,
      appointments: detailAppointments,
    };

    if (!existing) {
      groupedDetails.set(key, normalizedDetail);
      continue;
    }

    groupedDetails.set(key, mergeWarehouseDetails(existing, normalizedDetail));
  }

  for (const appointment of appointments) {
    if (existingAppointmentIds.has(appointment.sourceAppointmentId)) continue;
    if (!isMeaningfulWarehousePoint(appointment.warehousePoint)) continue;

    const warehousePoint = appointment.warehousePoint;
    const key = warehousePoint.toLowerCase();
    const warehouseAppointment = legacyAppointmentToWarehouseAppointment(
      appointment,
    );
    const existing = groupedDetails.get(key);

    if (!existing) {
      groupedDetails.set(key, {
        sourceOrderDetailId: `legacy:${appointment.sourceAppointmentId}`,
        deliveryNature: null,
        warehousePoint,
        windowPeriod: null,
        volume: null,
        estimatedPallets: appointment.palletCount,
        volumePercentage: null,
        warehouseLocation: null,
        actualPallets: appointment.palletCount,
        remainingPallets: null,
        deliveryProgress: null,
        fba: null,
        notes: null,
        po: null,
        appointments: [
          attachAppointmentDocuments(
            `legacy:${appointment.sourceAppointmentId}`,
            warehouseAppointment,
            documentMap,
          ),
        ],
      });
      continue;
    }

    groupedDetails.set(key, {
      ...existing,
      appointments: [
        ...existing.appointments,
        attachAppointmentDocuments(
          existing.sourceOrderDetailId,
          warehouseAppointment,
          documentMap,
        ),
      ],
    });
  }

  return [...groupedDetails.values()].map((detail) => ({
    ...detail,
    appointments: detail.appointments.sort(compareWarehouseAppointments),
  }));
}

function attachAppointmentDocuments(
  sourceOrderDetailId: string,
  appointment: WarehouseAppointment,
  documentMap: Map<string, AppointmentDocumentMeta>,
): WarehouseAppointment {
  return {
    ...appointment,
    sourceOrderDetailId,
    podDocument:
      documentMap.get(
        getAppointmentDocumentMapKey(
          sourceOrderDetailId,
          appointment.sourceAppointmentLineId,
          "pod",
        ),
      ) ?? emptyAppointmentDocument(),
    bolDocument:
      documentMap.get(
        getAppointmentDocumentMapKey(
          sourceOrderDetailId,
          appointment.sourceAppointmentLineId,
          "bol",
        ),
      ) ?? emptyAppointmentDocument(),
  };
}

function mergeWarehouseDetails(
  current: WarehouseDetail,
  next: WarehouseDetail,
): WarehouseDetail {
  return {
    ...current,
    sourceOrderDetailId: `${current.sourceOrderDetailId},${next.sourceOrderDetailId}`,
    deliveryNature: mergeText(current.deliveryNature, next.deliveryNature),
    windowPeriod: mergeText(current.windowPeriod, next.windowPeriod),
    volume: sumDecimalStrings(current.volume, next.volume),
    estimatedPallets: sumNullable(
      current.estimatedPallets,
      next.estimatedPallets,
    ),
    volumePercentage: sumDecimalStrings(
      current.volumePercentage,
      next.volumePercentage,
    ),
    warehouseLocation: mergeText(
      current.warehouseLocation,
      next.warehouseLocation,
    ),
    actualPallets: sumNullable(current.actualPallets, next.actualPallets),
    remainingPallets: sumNullable(
      current.remainingPallets,
      next.remainingPallets,
    ),
    deliveryProgress: current.deliveryProgress ?? next.deliveryProgress,
    fba: mergeText(current.fba, next.fba),
    notes: mergeText(current.notes, next.notes),
    po: mergeText(current.po, next.po),
    appointments: [...current.appointments, ...next.appointments],
  };
}

function legacyAppointmentToWarehouseAppointment(
  appointment: DeliveryAppointment,
): WarehouseAppointment {
  return {
    sourceOrderDetailId: "",
    sourceAppointmentLineId: `legacy:${appointment.sourceAppointmentId}`,
    sourceAppointmentId: appointment.sourceAppointmentId,
    appointmentNumber: appointment.isaNumber,
    deliveryDate: appointment.deliveryTime?.slice(0, 10) ?? null,
    estimatedPallets: appointment.palletCount,
    rejectedPallets: 0,
    effectivePallets: appointment.palletCount,
    podDocument: emptyAppointmentDocument(),
    bolDocument: emptyAppointmentDocument(),
  };
}

function toAppointmentDocumentMeta(
  document: AppointmentDocumentRow,
): AppointmentDocumentMeta {
  return {
    hasFile: Boolean(document.hasFile),
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: toNullableNumber(document.fileSize),
    uploadedAt: formatDateTime(document.uploadedAt),
  };
}

function emptyAppointmentDocument(): AppointmentDocumentMeta {
  return {
    hasFile: false,
    fileName: null,
    mimeType: null,
    fileSize: null,
    uploadedAt: null,
  };
}

function toContainerBillDocumentMeta(
  document: ContainerBillDocumentRow | null | undefined,
): AppointmentDocumentMeta {
  if (!document?.hasFile) return emptyAppointmentDocument();

  return {
    hasFile: true,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: toNullableNumber(document.fileSize),
    uploadedAt: formatDateTime(document.uploadedAt),
  };
}

function getAppointmentDocumentMapKey(
  sourceOrderDetailId: string,
  sourceAppointmentLineId: string,
  documentType: AppointmentDocumentType,
) {
  return `${sourceOrderDetailId}:${sourceAppointmentLineId}:${documentType}`;
}

function compareWarehouseAppointments(
  left: WarehouseAppointment,
  right: WarehouseAppointment,
) {
  return (
    (left.deliveryDate ?? "").localeCompare(right.deliveryDate ?? "") ||
    (left.appointmentNumber ?? "").localeCompare(right.appointmentNumber ?? "")
  );
}

function isMeaningfulWarehousePoint(value: string | null | undefined): value is string {
  return Boolean(value && value.trim() && value !== "未设置仓点");
}

function sumNullable(
  left: number | null,
  right: number | null,
): number | null {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function sumDecimalStrings(
  left: string | null,
  right: string | null,
): string | null {
  if (!left && !right) return null;
  const leftValue = left ? Number(left.replace(/,/g, "")) : 0;
  const rightValue = right ? Number(right.replace(/,/g, "")) : 0;
  if (Number.isNaN(leftValue) || Number.isNaN(rightValue)) {
    return mergeText(left, right);
  }

  return formatDecimal(leftValue + rightValue);
}

function mergeText(left: string | null, right: string | null): string | null {
  const values = [left, right]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value !== "—"));
  if (!values.length) return null;

  return [...new Set(values)].join(", ");
}

function formatOperationMode(value: string | null): string {
  if (value === "direct_delivery") return "直送";
  if (value === "unload") return "拆柜";
  return value ?? "未设置";
}

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDecimal(value: string | number | null): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(numberValue);
}

function toNullableNumber(value: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function isDateInput(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function normalizeEditableDate(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!isDateInput(normalized)) {
    throw new Error("INVALID_DATE");
  }

  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || formatDate(parsed) !== normalized) {
    throw new Error("INVALID_DATE");
  }

  return normalized;
}

function normalizeAppointmentValue(
  field: EditableAppointmentField,
  value: string | null | undefined,
): string | number | null {
  const normalized = value?.trim() ?? "";

  if (field === "palletCount") {
    if (!normalized) return null;
    if (!/^\d+$/.test(normalized)) throw new Error("INVALID_PALLET_COUNT");
    return Number(normalized);
  }

  if (field === "deliveryTime") {
    if (!normalized) return null;
    const match = normalized.match(
      /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})$/,
    );
    if (!match) throw new Error("INVALID_DATETIME");

    const parsed = new Date(`${match[1]}T${match[2]}:00Z`);
    if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_DATETIME");

    return `${match[1]} ${match[2]}:00+00`;
  }

  return normalized || null;
}

function normalizeWarehouseAppointmentValue(
  field: EditableWarehouseAppointmentField,
  value: string | null | undefined,
): string | number | null {
  const normalized = value?.trim() ?? "";

  if (field === "effectivePallets") {
    if (!normalized) return null;
    if (!/^\d+$/.test(normalized)) throw new Error("INVALID_PALLET_COUNT");
    return Number(normalized);
  }

  if (field === "deliveryDate") {
    if (!normalized) return null;
    if (!isDateInput(normalized)) throw new Error("INVALID_DATE");

    const parsed = new Date(`${normalized}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || formatDate(parsed) !== normalized) {
      throw new Error("INVALID_DATE");
    }

    return `${normalized} 00:00:00+00`;
  }

  return normalized || null;
}

function normalizeWarehouseDetailValue(
  field: EditableWarehouseDetailField,
  value: string | null | undefined,
): number | null {
  const normalized = value?.trim() ?? "";

  if (field === "actualPallets") {
    if (!normalized) return null;
    if (!/^\d+$/.test(normalized)) throw new Error("INVALID_PALLET_COUNT");
    return Number(normalized);
  }

  return null;
}

function formatDateTime(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}
