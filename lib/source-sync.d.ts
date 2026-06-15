declare module "@/lib/source-sync.mjs" {
  export type SyncSourceToSystemSummary = {
    status: "success";
    customers: number;
    containers: number;
    appointments: number;
    warehouseDetails: number;
    warehouseAppointments: number;
  };

  export type SyncSourceToSystemOptions = {
    logger?: (message: string) => void;
    sourceDatabaseUrl?: string;
    systemDatabaseUrl?: string;
  };

  export function syncSourceToSystem(
    options?: SyncSourceToSystemOptions,
  ): Promise<SyncSourceToSystemSummary>;
}
