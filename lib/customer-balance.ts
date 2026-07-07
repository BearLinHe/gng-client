import {
  rows,
  withAppReadOnlyTransaction,
  withAppTransaction,
} from "@/lib/db";

export type CustomerBalance = {
  balanceDueUsd: string;
  inventoryRemainingPallets: number;
  updatedAt: string | null;
};

type BalanceRow = {
  balanceDueUsd: string | number | null;
  inventoryRemainingPallets: string | number | null;
  updatedAt: Date | string | null;
};

export async function getCustomerBalance(
  customerId: string,
): Promise<CustomerBalance | null> {
  return withAppReadOnlyTransaction(async (client) => {
    const result = await client.query<BalanceRow>(
      `
        select
          balance_due_usd as "balanceDueUsd",
          inventory_remaining_pallets as "inventoryRemainingPallets",
          updated_at as "updatedAt"
        from public.portal_customers
        where source_customer_id = $1
          and source_active = true
        limit 1
      `,
      [customerId],
    );
    const balance = rows(result)[0];

    return balance ? toCustomerBalance(balance) : null;
  });
}

export async function updateCustomerBalance({
  customerId,
  balanceDueUsd,
}: {
  customerId: string;
  balanceDueUsd: string;
}): Promise<CustomerBalance | null> {
  return withAppTransaction(async (client) => {
    const result = await client.query<BalanceRow>(
      `
        update public.portal_customers
        set
          balance_due_usd = $2::numeric(12, 2),
          updated_at = now()
        where source_customer_id = $1
          and source_active = true
        returning
          balance_due_usd as "balanceDueUsd",
          inventory_remaining_pallets as "inventoryRemainingPallets",
          updated_at as "updatedAt"
      `,
      [customerId, balanceDueUsd],
    );
    const balance = rows(result)[0];

    return balance ? toCustomerBalance(balance) : null;
  });
}

function toCustomerBalance(balance: BalanceRow): CustomerBalance {
  return {
    balanceDueUsd: normalizeCurrencyValue(balance.balanceDueUsd),
    inventoryRemainingPallets: normalizeIntegerValue(
      balance.inventoryRemainingPallets,
    ),
    updatedAt: formatDateTime(balance.updatedAt),
  };
}

function normalizeCurrencyValue(value: string | number | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function normalizeIntegerValue(value: string | number | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
}

function formatDateTime(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}
