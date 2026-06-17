import { rows, withAppReadOnlyTransaction, withAppTransaction } from "@/lib/db";

export type CustomerVisibilitySettings = {
  showAppointmentNumber: boolean;
  showDeliveryDate: boolean;
  showEffectivePallets: boolean;
  showPod: boolean;
  showBol: boolean;
};

type CustomerVisibilitySettingsRow = {
  showAppointmentNumber: boolean | null;
  showDeliveryDate: boolean | null;
  showEffectivePallets: boolean | null;
  showPod: boolean | null;
  showBol: boolean | null;
};

export const defaultCustomerVisibilitySettings: CustomerVisibilitySettings = {
  showAppointmentNumber: true,
  showDeliveryDate: true,
  showEffectivePallets: true,
  showPod: true,
  showBol: true,
};

export async function getCustomerVisibilitySettings(
  customerId: string,
): Promise<CustomerVisibilitySettings | null> {
  return withAppReadOnlyTransaction(async (client) => {
    const result = await client.query<CustomerVisibilitySettingsRow>(
      `
        select
          show_appointment_number as "showAppointmentNumber",
          show_delivery_date as "showDeliveryDate",
          show_effective_pallets as "showEffectivePallets",
          show_pod as "showPod",
          show_bol as "showBol"
        from public.portal_customers
        where source_customer_id = $1
          and source_active = true
      `,
      [customerId],
    );

    const settings = rows(result)[0];
    return settings ? normalizeSettings(settings) : null;
  });
}

export async function updateCustomerVisibilitySettings({
  customerId,
  settings,
}: {
  customerId: string;
  settings: CustomerVisibilitySettings;
}): Promise<CustomerVisibilitySettings | null> {
  return withAppTransaction(async (client) => {
    const result = await client.query<CustomerVisibilitySettingsRow>(
      `
        update public.portal_customers
        set
          show_appointment_number = $2,
          show_delivery_date = $3,
          show_effective_pallets = $4,
          show_pod = $5,
          show_bol = $6,
          updated_at = now()
        where source_customer_id = $1
          and source_active = true
        returning
          show_appointment_number as "showAppointmentNumber",
          show_delivery_date as "showDeliveryDate",
          show_effective_pallets as "showEffectivePallets",
          show_pod as "showPod",
          show_bol as "showBol"
      `,
      [
        customerId,
        settings.showAppointmentNumber,
        settings.showDeliveryDate,
        settings.showEffectivePallets,
        settings.showPod,
        settings.showBol,
      ],
    );

    const updated = rows(result)[0];
    return updated ? normalizeSettings(updated) : null;
  });
}

export function normalizeSettings(
  settings: Partial<CustomerVisibilitySettings> | CustomerVisibilitySettingsRow,
): CustomerVisibilitySettings {
  return {
    showAppointmentNumber:
      settings.showAppointmentNumber ??
      defaultCustomerVisibilitySettings.showAppointmentNumber,
    showDeliveryDate:
      settings.showDeliveryDate ??
      defaultCustomerVisibilitySettings.showDeliveryDate,
    showEffectivePallets:
      settings.showEffectivePallets ??
      defaultCustomerVisibilitySettings.showEffectivePallets,
    showPod: settings.showPod ?? defaultCustomerVisibilitySettings.showPod,
    showBol: settings.showBol ?? defaultCustomerVisibilitySettings.showBol,
  };
}
