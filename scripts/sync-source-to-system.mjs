import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

await loadDotEnv(".env.local");

const sourceDatabaseUrl =
  process.env.READONLY_DATABASE_URL ?? process.env.DATABASE_URL;
const systemDatabaseUrl = process.env.SYSTEM_DATABASE_URL;

if (!sourceDatabaseUrl) {
  throw new Error("READONLY_DATABASE_URL or DATABASE_URL is not configured.");
}

if (!systemDatabaseUrl) {
  throw new Error("SYSTEM_DATABASE_URL is not configured.");
}

const sourceClient = new Client({
  connectionString: sourceDatabaseUrl,
  ssl: { rejectUnauthorized: true },
});

const systemClient = new Client({
  connectionString: systemDatabaseUrl,
  ssl: { rejectUnauthorized: true },
});

const orderQuery = `
  select
    o.order_id::text as source_order_id,
    o.order_number as container_number,
    c.id::text as source_customer_id,
    nullif(c.code, '') as customer_code,
    coalesce(nullif(c.name, ''), '未分配客户') as customer_name,
    o.order_date::text as order_date,
    o.eta_date::text as eta_date,
    o.lfd_date::text as lfd_date,
    o.pickup_date::text as pickup_date,
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
    detail_points.warehouse_points
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
  where o.order_number is not null
    and btrim(o.order_number) <> ''
  order by o.order_date desc nulls last, o.eta_date desc nulls last, o.order_number asc
`;

const appointmentQuery = `
  with order_scope as (
    select o.order_id, o.order_id::text as source_order_id
    from public.orders o
    where o.order_id = any($1::bigint[])
      and o.order_number is not null
      and btrim(o.order_number) <> ''
  ),
  detail_scope as (
    select
      os.source_order_id,
      od.id as order_detail_id,
      coalesce(
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
    from order_scope os
    join public.order_detail od
      on od.order_id = os.order_id
    left join public.locations detail_location
      on detail_location.location_id = od.delivery_location_id
  ),
  appointment_links as (
    select
      os.source_order_id,
      da.appointment_id,
      null::text as detail_warehouse_point
    from order_scope os
    join oms.delivery_appointments da
      on da.order_id = os.order_id
    where da.appointment_id is not null

    union

    select
      ds.source_order_id,
      da.appointment_id,
      ds.warehouse_point as detail_warehouse_point
    from detail_scope ds
    join oms.appointment_detail_lines adl
      on adl.order_detail_id = ds.order_detail_id
    join oms.delivery_appointments da
      on da.appointment_id = adl.appointment_id
    where da.appointment_id is not null
  ),
  appointment_scope as (
    select distinct on (source_order_id, appointment_id)
      source_order_id,
      appointment_id,
      detail_warehouse_point
    from appointment_links
    order by
      source_order_id,
      appointment_id,
      detail_warehouse_point nulls last
  )
  select
    aps.source_order_id,
    da.appointment_id::text as source_appointment_id,
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
      aps.detail_warehouse_point,
      da.location_id::text,
      '未设置仓点'
    ) as warehouse_point,
    da.reference_number,
    da.confirmed_start::text as delivery_time,
    coalesce(
      nullif(sum(coalesce(adl_all.estimated_pallets, 0)), 0)::int,
      da.total_pallets
    ) as pallet_count
  from appointment_scope aps
  join oms.delivery_appointments da
    on da.appointment_id = aps.appointment_id
  left join public.locations appointment_location
    on appointment_location.location_id = da.location_id
  left join oms.appointment_detail_lines adl_all
    on adl_all.appointment_id = da.appointment_id
  group by
    aps.source_order_id,
    da.appointment_id,
    appointment_location.location_code,
    appointment_location.name,
    aps.detail_warehouse_point,
    da.location_id,
    da.reference_number,
    da.confirmed_start,
    da.total_pallets
  order by warehouse_point asc, da.confirmed_start asc nulls last, da.reference_number asc nulls last
`;

async function main() {
  const startedAt = new Date();

  await sourceClient.connect();
  await systemClient.connect();

  try {
    await sourceClient.query("BEGIN READ ONLY");
    await systemClient.query("BEGIN");
    await ensureSystemSchema(systemClient);

    console.log("Reading source orders...");
    const orderResult = await sourceClient.query(orderQuery);
    const sourceRows = orderResult.rows;
    console.log(`Read ${sourceRows.length} source orders.`);

    const appointmentsByOrderId = new Map();
    const orderIds = sourceRows.map((row) => Number(row.source_order_id));
    const chunkSize = 250;

    console.log("Reading source appointments...");
    for (let index = 0; index < orderIds.length; index += chunkSize) {
      const chunk = orderIds.slice(index, index + chunkSize);
      const appointmentResult = await sourceClient.query(appointmentQuery, [chunk]);
      mergeAppointments(appointmentsByOrderId, appointmentResult.rows);
      console.log(
        `Read appointments for ${Math.min(
          index + chunk.length,
          orderIds.length,
        )}/${orderIds.length} orders.`,
      );
    }
    const customerMap = new Map();

    for (const row of sourceRows) {
      if (!row.source_customer_id) continue;
      customerMap.set(row.source_customer_id, {
        id: row.source_customer_id,
        code: row.customer_code,
        name: row.customer_name,
      });
    }

    await systemClient.query(
      "update public.portal_customers set source_active = false",
    );
    await systemClient.query(
      "update public.portal_containers set source_active = false",
    );

    console.log("Writing customers into system database...");
    await upsertCustomers(systemClient, [...customerMap.values()]);

    console.log("Writing source orders into system database...");
    const syncedOrderIds = sourceRows.map((row) => row.source_order_id);
    await upsertContainers(systemClient, sourceRows);

    if (syncedOrderIds.length) {
      await systemClient.query(
        "update public.portal_delivery_appointments set source_active = false where source_order_id = any($1::text[])",
        [syncedOrderIds],
      );
    }

    let appointmentCount = 0;
    console.log("Writing appointments into system database...");
    const appointmentPayload = [];
    for (const row of sourceRows) {
      const appointments = appointmentsByOrderId.get(row.source_order_id) ?? [];

      for (const appointment of appointments) {
        appointmentPayload.push({
          source_order_id: row.source_order_id,
          source_appointment_id: appointment.source_appointment_id,
          source_warehouse_point: appointment.warehouse_point,
          source_isa_number: appointment.reference_number,
          source_delivery_time: appointment.delivery_time,
          source_pallet_count: appointment.pallet_count,
        });
        appointmentCount += 1;
      }
    }
    await upsertAppointments(systemClient, appointmentPayload);

    await migrateLocalPasswords(systemClient);

    await systemClient.query(
      `
        insert into public.portal_sync_runs (
          started_at,
          finished_at,
          status,
          customer_count,
          container_count,
          appointment_count
        )
        values ($1, now(), 'success', $2, $3, $4)
      `,
      [startedAt, customerMap.size, sourceRows.length, appointmentCount],
    );

    await systemClient.query("COMMIT");
    await sourceClient.query("ROLLBACK");

    console.log(
      JSON.stringify(
        {
          status: "success",
          customers: customerMap.size,
          containers: sourceRows.length,
          appointments: appointmentCount,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await systemClient.query("ROLLBACK").catch(() => undefined);
    await sourceClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await sourceClient.end().catch(() => undefined);
    await systemClient.end().catch(() => undefined);
  }
}

async function ensureSystemSchema(client) {
  await client.query(`
    create table if not exists public.portal_customers (
      source_customer_id text primary key,
      code text unique,
      name text not null,
      source_active boolean not null default true,
      synced_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.portal_containers (
      source_order_id text primary key,
      container_number text not null,
      source_customer_id text references public.portal_customers(source_customer_id),
      source_order_date date,
      source_eta_date date,
      source_lfd_date date,
      source_pickup_date date,
      source_operation_mode text,
      source_destination text,
      source_warehouse_points text,
      source_active boolean not null default true,
      manual_order_date date,
      manual_eta_date date,
      manual_lfd_date date,
      manual_pickup_date date,
      manual_order_date_override boolean not null default false,
      manual_eta_date_override boolean not null default false,
      manual_lfd_date_override boolean not null default false,
      manual_pickup_date_override boolean not null default false,
      manual_operation_mode text,
      manual_destination text,
      manual_warehouse_points text,
      synced_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.portal_delivery_appointments (
      source_order_id text not null references public.portal_containers(source_order_id) on delete cascade,
      source_appointment_id text not null,
      source_warehouse_point text,
      source_isa_number text,
      source_delivery_time timestamptz,
      source_pallet_count integer,
      source_active boolean not null default true,
      manual_warehouse_point text,
      manual_isa_number text,
      manual_delivery_time timestamptz,
      manual_pallet_count integer,
      manual_warehouse_point_override boolean not null default false,
      manual_isa_number_override boolean not null default false,
      manual_delivery_time_override boolean not null default false,
      manual_pallet_count_override boolean not null default false,
      synced_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (source_order_id, source_appointment_id)
    );

    create table if not exists public.portal_customer_passwords (
      customer_code_normalized text primary key,
      password_hash text not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists public.portal_sync_runs (
      id bigserial primary key,
      started_at timestamptz not null,
      finished_at timestamptz,
      status text not null,
      customer_count integer not null default 0,
      container_count integer not null default 0,
      appointment_count integer not null default 0,
      message text
    );

    create index if not exists portal_containers_customer_idx
      on public.portal_containers(source_customer_id);
    create index if not exists portal_containers_number_idx
      on public.portal_containers(container_number);
    create index if not exists portal_containers_active_idx
      on public.portal_containers(source_active);
    create index if not exists portal_delivery_appointments_order_idx
      on public.portal_delivery_appointments(source_order_id);
  `);

  await client.query(`
    alter table public.portal_containers
      add column if not exists manual_order_date_override boolean not null default false,
      add column if not exists manual_eta_date_override boolean not null default false,
      add column if not exists manual_lfd_date_override boolean not null default false,
      add column if not exists manual_pickup_date_override boolean not null default false;
  `);

  await client.query(`
    alter table public.portal_delivery_appointments
      add column if not exists manual_warehouse_point_override boolean not null default false,
      add column if not exists manual_isa_number_override boolean not null default false,
      add column if not exists manual_delivery_time_override boolean not null default false,
      add column if not exists manual_pallet_count_override boolean not null default false,
      add column if not exists source_active boolean not null default true;
  `);
}

function groupAppointments(appointments) {
  const grouped = new Map();
  mergeAppointments(grouped, appointments);
  return grouped;
}

function mergeAppointments(grouped, appointments) {
  for (const appointment of appointments) {
    if (!grouped.has(appointment.source_order_id)) {
      grouped.set(appointment.source_order_id, []);
    }
    grouped.get(appointment.source_order_id).push(appointment);
  }
}

async function upsertCustomers(client, customers) {
  if (!customers.length) return;

  await client.query(
    `
      insert into public.portal_customers (
        source_customer_id,
        code,
        name,
        source_active,
        synced_at,
        updated_at
      )
      select
        source_customer_id,
        code,
        name,
        true,
        now(),
        now()
      from jsonb_to_recordset($1::jsonb) as customer(
        source_customer_id text,
        code text,
        name text
      )
      on conflict (source_customer_id)
      do update set
        code = excluded.code,
        name = excluded.name,
        source_active = true,
        synced_at = now(),
        updated_at = now()
    `,
    [JSON.stringify(customers.map(({ id, code, name }) => ({
      source_customer_id: id,
      code,
      name,
    })))],
  );
}

async function upsertContainers(client, containers) {
  for (const chunk of chunks(containers, 1000)) {
    await client.query(
      `
        insert into public.portal_containers (
          source_order_id,
          container_number,
          source_customer_id,
          source_order_date,
          source_eta_date,
          source_lfd_date,
          source_pickup_date,
          source_operation_mode,
          source_destination,
          source_warehouse_points,
          source_active,
          synced_at,
          updated_at
        )
        select
          source_order_id,
          container_number,
          source_customer_id,
          order_date::date,
          eta_date::date,
          lfd_date::date,
          pickup_date::date,
          operation_mode,
          destination,
          warehouse_points,
          true,
          now(),
          now()
        from jsonb_to_recordset($1::jsonb) as container(
          source_order_id text,
          container_number text,
          source_customer_id text,
          order_date text,
          eta_date text,
          lfd_date text,
          pickup_date text,
          operation_mode text,
          destination text,
          warehouse_points text
        )
        on conflict (source_order_id)
        do update set
          container_number = excluded.container_number,
          source_customer_id = excluded.source_customer_id,
          source_order_date = excluded.source_order_date,
          source_eta_date = excluded.source_eta_date,
          source_lfd_date = excluded.source_lfd_date,
          source_pickup_date = excluded.source_pickup_date,
          source_operation_mode = excluded.source_operation_mode,
          source_destination = excluded.source_destination,
          source_warehouse_points = excluded.source_warehouse_points,
          source_active = true,
          synced_at = now(),
          updated_at = now()
      `,
      [JSON.stringify(chunk)],
    );
  }
}

async function upsertAppointments(client, appointments) {
  for (const chunk of chunks(appointments, 2000)) {
    await client.query(
      `
        insert into public.portal_delivery_appointments (
          source_order_id,
          source_appointment_id,
          source_warehouse_point,
          source_isa_number,
          source_delivery_time,
          source_pallet_count,
          source_active,
          synced_at,
          updated_at
        )
        select
          source_order_id,
          source_appointment_id,
          source_warehouse_point,
          source_isa_number,
          source_delivery_time::timestamptz,
          source_pallet_count,
          true,
          now(),
          now()
        from jsonb_to_recordset($1::jsonb) as appointment(
          source_order_id text,
          source_appointment_id text,
          source_warehouse_point text,
          source_isa_number text,
          source_delivery_time text,
          source_pallet_count integer
        )
        on conflict (source_order_id, source_appointment_id)
        do update set
          source_warehouse_point = excluded.source_warehouse_point,
          source_isa_number = excluded.source_isa_number,
          source_delivery_time = excluded.source_delivery_time,
          source_pallet_count = excluded.source_pallet_count,
          source_active = true,
          synced_at = now(),
          updated_at = now()
      `,
      [JSON.stringify(chunk)],
    );
  }
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function migrateLocalPasswords(client) {
  try {
    const passwordPath = path.join(projectRoot, "data", "customer-passwords.json");
    const passwordJson = JSON.parse(await readFile(passwordPath, "utf8"));

    for (const [customerCodeNormalized, passwordHash] of Object.entries(
      passwordJson,
    )) {
      if (!customerCodeNormalized || !passwordHash) continue;
      await client.query(
        `
          insert into public.portal_customer_passwords (
            customer_code_normalized,
            password_hash,
            updated_at
          )
          values ($1, $2, now())
          on conflict (customer_code_normalized)
          do nothing
        `,
        [customerCodeNormalized, passwordHash],
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function loadDotEnv(fileName) {
  const filePath = path.join(projectRoot, fileName);
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) continue;

      const key = trimmed.slice(0, separatorIndex);
      const value = trimmed
        .slice(separatorIndex + 1)
        .replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await main();
