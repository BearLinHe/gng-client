"use client";

import Image from "next/image";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  LoaderCircle,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingFn,
  type SortingState,
} from "@tanstack/react-table";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type CustomerOption = {
  id: string;
  code: string | null;
  name: string;
  role: "customer" | "admin";
};

type CustomerBalance = {
  balanceDueUsd: string;
  inventoryRemainingPallets: number;
  updatedAt: string | null;
};

type CustomerVisibilitySettings = {
  showAppointmentNumber: boolean;
  showDeliveryDate: boolean;
  showEffectivePallets: boolean;
  showPod: boolean;
  showBol: boolean;
};

type SyncRunStatus = {
  id: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  customerCount: number;
  containerCount: number;
  appointmentCount: number;
  message: string | null;
};

type ContainerRecord = {
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
  extraChargeResponsibility: string | null;
  appointments: DeliveryAppointment[];
  warehouseDetails: WarehouseDetail[];
  billDocument: AppointmentDocumentMeta;
};

type TableContainerRecord = ContainerRecord & {
  rowId: string;
};

type DateFilterField = "orderDate" | "etaDate" | "lfdDate" | "pickupDate";
type EditableDateField = DateFilterField;
type EditableAppointmentField =
  | "warehousePoint"
  | "isaNumber"
  | "deliveryTime"
  | "palletCount";
type EditableWarehouseAppointmentField =
  | "appointmentNumber"
  | "deliveryDate"
  | "effectivePallets";
type EditableWarehouseDetailField = "actualPallets";
type EditableContainerTextField = "extraChargeResponsibility";
type EditableWarehouseDetailTextField = "customerNote";
type AppointmentDocumentType = "pod" | "bol";
type PickupStatus = "all" | "pending" | "picked";

type DeliveryAppointment = {
  sourceAppointmentId: string;
  warehousePoint: string;
  isaNumber: string | null;
  deliveryTime: string | null;
  palletCount: number | null;
};

type WarehouseDetail = {
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
  customerNote: string | null;
  appointments: WarehouseAppointment[];
};

type WarehouseAppointment = {
  sourceOrderDetailId: string;
  sourceAppointmentLineId: string;
  sourceAppointmentId: string | null;
  appointmentNumber: string | null;
  deliveryDate: string | null;
  estimatedPallets: number | null;
  rejectedPallets: number | null;
  effectivePallets: number | null;
  isCustomerVisible: boolean;
  podDocument: AppointmentDocumentMeta;
  bolDocument: AppointmentDocumentMeta;
};

type AppointmentDocumentMeta = {
  hasFile: boolean;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
};

type ContainerPayload = {
  containers: ContainerRecord[];
  total: number;
  allContainers: number;
  involvedCustomers: number;
  pendingPickup: number;
  pickedUp: number;
  page: number;
  pageSize: number;
};

type LoadState = "idle" | "loading" | "error";
type RowDragSession = {
  sourceRowId: string;
  targetRowId: string | null;
  rafId: number | null;
};
const PAGE_SIZE = 100;
const MAX_INLINE_LOCATIONS = 3;
const defaultCustomerVisibilitySettings: CustomerVisibilitySettings = {
  showAppointmentNumber: true,
  showDeliveryDate: true,
  showEffectivePallets: true,
  showPod: true,
  showBol: true,
};
const customerVisibilityOptions: Array<{
  key: keyof CustomerVisibilitySettings;
  label: string;
}> = [
  { key: "showAppointmentNumber", label: "ISA号码" },
  { key: "showDeliveryDate", label: "送仓日" },
  { key: "showEffectivePallets", label: "有效板数" },
  { key: "showPod", label: "POD" },
  { key: "showBol", label: "BOL" },
];

export default function ContainerDashboard() {
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [customerSwitchCode, setCustomerSwitchCode] = useState("");
  const [customerSwitchState, setCustomerSwitchState] =
    useState<LoadState>("idle");
  const [customerSwitchMessage, setCustomerSwitchMessage] = useState("");
  const [customerBalance, setCustomerBalance] =
    useState<CustomerBalance | null>(null);
  const [customerSettings, setCustomerSettings] =
    useState<CustomerVisibilitySettings>(defaultCustomerVisibilitySettings);
  const [settingsState, setSettingsState] = useState<LoadState>("idle");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [balanceDraft, setBalanceDraft] = useState("");
  const [balanceState, setBalanceState] = useState<LoadState>("idle");
  const [balanceMessage, setBalanceMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncRunStatus | null>(null);
  const [syncStatusState, setSyncStatusState] = useState<LoadState>("idle");
  const [syncStatusMessage, setSyncStatusMessage] = useState("");
  const [syncActionState, setSyncActionState] = useState<LoadState>("idle");
  const [syncStatusTick, setSyncStatusTick] = useState(0);
  const [containers, setContainers] = useState<TableContainerRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [allContainers, setAllContainers] = useState(0);
  const [pendingPickup, setPendingPickup] = useState(0);
  const [pickedUp, setPickedUp] = useState(0);
  const [pickupStatus, setPickupStatus] = useState<PickupStatus>("all");
  const [selectedOperationMode, setSelectedOperationMode] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateField, setDateField] = useState<DateFilterField>("orderDate");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordState, setPasswordState] = useState<LoadState>("idle");
  const [authChecked, setAuthChecked] = useState(false);
  const [loginState, setLoginState] = useState<LoadState>("idle");
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [mockLongTable, setMockLongTable] = useState(false);
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedWarehouseDetails, setExpandedWarehouseDetails] = useState<
    Set<string>
  >(() => new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [copiedContainer, setCopiedContainer] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [editingDateCell, setEditingDateCell] = useState<{
    rowId: string;
    field: EditableDateField;
  } | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [savingDateCells, setSavingDateCells] = useState<Set<string>>(
    () => new Set(),
  );
  const [dateCellErrors, setDateCellErrors] = useState<Record<string, string>>(
    {},
  );
  const [editingAppointmentCell, setEditingAppointmentCell] = useState<{
    rowId: string;
    sourceOrderDetailId: string;
    sourceAppointmentLineId: string;
    field: EditableWarehouseAppointmentField;
  } | null>(null);
  const [appointmentDraft, setAppointmentDraft] = useState("");
  const [savingAppointmentCells, setSavingAppointmentCells] = useState<
    Set<string>
  >(() => new Set());
  const [appointmentCellErrors, setAppointmentCellErrors] = useState<
    Record<string, string>
  >({});
  const [savingAppointmentDocuments, setSavingAppointmentDocuments] = useState<
    Set<string>
  >(() => new Set());
  const [appointmentDocumentErrors, setAppointmentDocumentErrors] = useState<
    Record<string, string>
  >({});
  const [savingAppointmentVisibility, setSavingAppointmentVisibility] =
    useState<Set<string>>(() => new Set());
  const [appointmentVisibilityErrors, setAppointmentVisibilityErrors] =
    useState<Record<string, string>>({});
  const [savingTextCells, setSavingTextCells] = useState<Set<string>>(
    () => new Set(),
  );
  const [textCellErrors, setTextCellErrors] = useState<Record<string, string>>(
    {},
  );
  const [savingContainerBills, setSavingContainerBills] = useState<Set<string>>(
    () => new Set(),
  );
  const [containerBillErrors, setContainerBillErrors] = useState<
    Record<string, string>
  >({});
  const [editingWarehouseDetailCell, setEditingWarehouseDetailCell] = useState<{
    rowId: string;
    sourceOrderDetailId: string;
    field: EditableWarehouseDetailField;
  } | null>(null);
  const [warehouseDetailDraft, setWarehouseDetailDraft] = useState("");
  const [savingWarehouseDetailCells, setSavingWarehouseDetailCells] = useState<
    Set<string>
  >(() => new Set());
  const [warehouseDetailCellErrors, setWarehouseDetailCellErrors] = useState<
    Record<string, string>
  >({});
  const savingDateKeysRef = useRef(new Set<string>());
  const savingDateTimeoutsRef = useRef(new Map<string, number>());
  const savingAppointmentKeysRef = useRef(new Set<string>());
  const savingAppointmentTimeoutsRef = useRef(new Map<string, number>());
  const savingAppointmentDocumentKeysRef = useRef(new Set<string>());
  const savingAppointmentVisibilityKeysRef = useRef(new Set<string>());
  const savingTextCellKeysRef = useRef(new Set<string>());
  const savingContainerBillKeysRef = useRef(new Set<string>());
  const savingWarehouseDetailKeysRef = useRef(new Set<string>());
  const savingWarehouseDetailTimeoutsRef = useRef(new Map<string, number>());
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const rowDragSessionRef = useRef<RowDragSession | null>(null);
  const rowDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dateTimeouts = savingDateTimeoutsRef.current;
    const appointmentTimeouts = savingAppointmentTimeoutsRef.current;
    const warehouseDetailTimeouts = savingWarehouseDetailTimeoutsRef.current;

    return () => {
      rowDragCleanupRef.current?.();
      const session = rowDragSessionRef.current;
      if (session?.rafId !== null && session?.rafId !== undefined) {
        window.cancelAnimationFrame(session.rafId);
      }
      for (const timeoutId of dateTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      for (const timeoutId of appointmentTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      for (const timeoutId of warehouseDetailTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      document.body.classList.remove("rowDragActive");
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    setMockLongTable(
      new URLSearchParams(window.location.search).get("mockTable") === "long",
    );
  }, [mockLongTable]);

  useEffect(() => {
    if (!mockLongTable) return;

    setCustomer({
      id: "mock-customer",
      code: "TEST",
      name: "Long Text Layout Test",
      role: "admin",
    });
    setAuthChecked(true);
  }, [mockLongTable]);

  useEffect(() => {
    let ignore = false;

    if (!customer) {
      setCustomerSettings(defaultCustomerVisibilitySettings);
      setSettingsState("idle");
      setSettingsMessage("");
      return;
    }

    if (mockLongTable) {
      setCustomerSettings(defaultCustomerVisibilitySettings);
      setSettingsState("idle");
      setSettingsMessage("");
      return;
    }

    async function loadCustomerSettings() {
      setSettingsState("loading");
      setSettingsMessage("");

      const response = await fetch("/api/customers/settings");
      const payload = (await response.json()) as {
        settings?: CustomerVisibilitySettings;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "客户显示设置读取失败");
      }

      if (!ignore) {
        setCustomerSettings(payload.settings);
        setSettingsState("idle");
      }
    }

    loadCustomerSettings().catch((settingsError) => {
      if (!ignore) {
        setCustomerSettings(defaultCustomerVisibilitySettings);
        setSettingsState("error");
        setSettingsMessage(
          settingsError instanceof Error
            ? settingsError.message
            : "客户显示设置读取失败",
        );
      }
    });

    return () => {
      ignore = true;
    };
  }, [customer, mockLongTable, refreshTick, syncStatusTick]);

  useEffect(() => {
    let ignore = false;

    if (mockLongTable) return;

    async function loadSession() {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        if (!ignore) {
          setCustomer(null);
          setAuthChecked(true);
        }
        return;
      }

      const payload = (await response.json()) as { customer: CustomerOption };
      if (!ignore) {
        setCustomer(payload.customer);
        setCustomerSwitchCode(payload.customer.code ?? "");
        setAuthChecked(true);
      }
    }

    loadSession().catch(() => {
      if (!ignore) {
        setCustomer(null);
        setAuthChecked(true);
      }
    });

    return () => {
      ignore = true;
    };
  }, [mockLongTable]);

  useEffect(() => {
    let ignore = false;

    if (!customer || customer.role !== "admin") {
      setCustomerOptions([]);
      setCustomerSwitchCode("");
      setCustomerSwitchState("idle");
      setCustomerSwitchMessage("");
      return;
    }
    const activeCustomer = customer;

    if (mockLongTable) {
      const mockOptions = [
        activeCustomer,
        {
          id: "mock-customer-2",
          code: "MEITONG-OAK",
          name: "MEITONG",
          role: "admin" as const,
        },
        {
          id: "mock-customer-3",
          code: "XINGHANG-OAK",
          name: "XINGHANG（星航）",
          role: "admin" as const,
        },
      ];
      setCustomerOptions(mockOptions);
      setCustomerSwitchCode(activeCustomer.code ?? "");
      setCustomerSwitchState("idle");
      setCustomerSwitchMessage("");
      return;
    }

    async function loadCustomerOptions() {
      setCustomerSwitchState("loading");
      setCustomerSwitchMessage("");

      const response = await fetch("/api/customers");
      const payload = (await response.json()) as {
        customers?: CustomerOption[];
        error?: string;
      };

      if (!response.ok || !payload.customers) {
        throw new Error(payload.error ?? "客户列表读取失败");
      }

      if (!ignore) {
        setCustomerOptions(payload.customers);
        setCustomerSwitchCode(activeCustomer.code ?? "");
        setCustomerSwitchState("idle");
      }
    }

    loadCustomerOptions().catch((switchError) => {
      if (!ignore) {
        setCustomerOptions([]);
        setCustomerSwitchState("error");
        setCustomerSwitchMessage(
          switchError instanceof Error
            ? switchError.message
            : "客户列表读取失败",
        );
      }
    });

    return () => {
      ignore = true;
    };
  }, [customer, mockLongTable]);

  useEffect(() => {
    let ignore = false;

    if (!customer) {
      setCustomerBalance(null);
      setBalanceDraft("");
      setBalanceMessage("");
      setBalanceState("idle");
      return;
    }

    if (mockLongTable) {
      const mockBalance = {
        balanceDueUsd: "1234.56",
        inventoryRemainingPallets: 128,
        updatedAt: null,
      };
      setCustomerBalance(mockBalance);
      setBalanceDraft(mockBalance.balanceDueUsd);
      setBalanceMessage("");
      setBalanceState("idle");
      return;
    }

    async function loadCustomerBalance() {
      setBalanceState("loading");
      setBalanceMessage("");

      const response = await fetch("/api/customers/balance");
      const payload = (await response.json()) as {
        balance?: CustomerBalance;
        error?: string;
      };

      if (!response.ok || !payload.balance) {
        throw new Error(payload.error ?? "未结账款读取失败");
      }

      if (!ignore) {
        setCustomerBalance(payload.balance);
        setBalanceDraft(payload.balance.balanceDueUsd);
        setBalanceState("idle");
      }
    }

    loadCustomerBalance().catch((balanceError) => {
      if (!ignore) {
        setCustomerBalance(null);
        setBalanceDraft("");
        setBalanceState("error");
        setBalanceMessage(
          balanceError instanceof Error
            ? balanceError.message
            : "未结账款读取失败",
        );
      }
    });

    return () => {
      ignore = true;
    };
  }, [customer, mockLongTable, refreshTick, syncStatusTick]);

  useEffect(() => {
    if (customer?.role !== "admin" || mockLongTable) return;

    const intervalId = window.setInterval(() => {
      setSyncStatusTick((value) => value + 1);
    }, 300000);

    return () => window.clearInterval(intervalId);
  }, [customer, mockLongTable]);

  useEffect(() => {
    let ignore = false;

    if (customer?.role !== "admin") {
      setSyncStatus(null);
      setSyncStatusState("idle");
      setSyncStatusMessage("");
      return;
    }

    if (mockLongTable) {
      setSyncStatus({
        id: "mock-sync",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "success",
        customerCount: 108,
        containerCount: 4739,
        appointmentCount: 19274,
        message: null,
      });
      setSyncStatusState("idle");
      setSyncStatusMessage("");
      return;
    }

    async function loadSyncStatus() {
      setSyncStatusState("loading");
      setSyncStatusMessage("");

      const response = await fetch("/api/admin/sync/status");
      const payload = (await response.json()) as {
        syncRun?: SyncRunStatus | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "同步状态读取失败");
      }

      if (!ignore) {
        setSyncStatus(payload.syncRun ?? null);
        setSyncStatusState("idle");
      }
    }

    loadSyncStatus().catch((statusError) => {
      if (!ignore) {
        setSyncStatusState("error");
        setSyncStatusMessage(
          statusError instanceof Error
            ? statusError.message
            : "同步状态读取失败",
        );
      }
    });

    return () => {
      ignore = true;
    };
  }, [customer, mockLongTable, refreshTick]);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [dateField, dateFrom, dateTo, pickupStatus, selectedOperationMode, search]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();

    if (!customer) return;

    if (mockLongTable) {
      const payload = getMockContainerPayload({
        operationMode: selectedOperationMode,
        search,
        dateField,
        dateFrom,
        dateTo,
        pickupStatus,
        page,
        pageSize: PAGE_SIZE,
      });

      setContainers(payload.containers);
      setTotalCount(payload.total);
      setAllContainers(payload.allContainers);
      setPendingPickup(payload.pendingPickup);
      setPickedUp(payload.pickedUp);
      setExpandedContainers(new Set());
      setExpandedWarehouseDetails(new Set());
      setSorting([]);
      setDraggedRowId(null);
      setDragOverRowId(null);
      setEditingDateCell(null);
      setDateCellErrors({});
      clearAllDateSaving();
      setEditingAppointmentCell(null);
      setAppointmentCellErrors({});
      clearAllAppointmentSaving();
      setAppointmentDocumentErrors({});
      setSavingAppointmentDocuments(new Set());
      savingAppointmentDocumentKeysRef.current.clear();
      setTextCellErrors({});
      setSavingTextCells(new Set());
      savingTextCellKeysRef.current.clear();
      setContainerBillErrors({});
      setSavingContainerBills(new Set());
      savingContainerBillKeysRef.current.clear();
      setEditingWarehouseDetailCell(null);
      setWarehouseDetailCellErrors({});
      clearAllWarehouseDetailSaving();
      setLoadState("idle");
      setError("");
      return;
    }

    if (selectedOperationMode) {
      params.set("operationMode", selectedOperationMode);
    }
    if (search) params.set("search", search);
    if (dateFrom || dateTo) {
      params.set("dateField", dateField);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    }
    if (pickupStatus !== "all") params.set("pickupStatus", pickupStatus);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    async function loadContainers() {
      setLoadState("loading");
      setError("");

      const response = await fetch(`/api/containers?${params.toString()}`);
      if (!response.ok) throw new Error("柜号数据读取失败");

      const payload = (await response.json()) as ContainerPayload;
      if (!ignore) {
        setContainers(
          payload.containers.map((container, index) => ({
            ...container,
            rowId: createRowId(container, index),
          })),
        );
        setTotalCount(payload.total);
        setAllContainers(payload.allContainers);
        setPendingPickup(payload.pendingPickup);
        setPickedUp(payload.pickedUp);
        setExpandedContainers(new Set());
        setExpandedWarehouseDetails(new Set());
        setSorting([]);
        setDraggedRowId(null);
        setDragOverRowId(null);
        setEditingDateCell(null);
        setDateCellErrors({});
        clearAllDateSaving();
        setEditingAppointmentCell(null);
        setAppointmentCellErrors({});
        clearAllAppointmentSaving();
        setAppointmentDocumentErrors({});
        setSavingAppointmentDocuments(new Set());
        savingAppointmentDocumentKeysRef.current.clear();
        setTextCellErrors({});
        setSavingTextCells(new Set());
        savingTextCellKeysRef.current.clear();
        setContainerBillErrors({});
        setSavingContainerBills(new Set());
        savingContainerBillKeysRef.current.clear();
        setEditingWarehouseDetailCell(null);
        setWarehouseDetailCellErrors({});
        clearAllWarehouseDetailSaving();
        setLoadState("idle");
      }
    }

    loadContainers().catch(() => {
      if (!ignore) {
        setLoadState("error");
        setError("柜号数据读取失败，请重新登录或稍后再试。");
      }
    });

    return () => {
      ignore = true;
    };
  }, [
    customer,
    dateField,
    dateFrom,
    dateTo,
    mockLongTable,
    pickupStatus,
    refreshTick,
    selectedOperationMode,
    search,
    page,
  ]);

  const pageStats = useMemo(() => {
    const uniqueContainers = new Set(
      containers.map((container) => container.containerNumber),
    ).size;

    return { uniqueContainers };
  }, [containers]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount);
  const isAdmin = customer?.role === "admin";
  const balanceAmountClass = `balanceAmount ${getBalanceTone(
    customerBalance?.balanceDueUsd,
  )}`;
  const syncStatusClass = `syncStatusPill ${getSyncStatusTone(
    syncStatus,
    syncStatusState,
    syncActionState,
  )}`;
  const appointmentColumnSettings = isAdmin
    ? defaultCustomerVisibilitySettings
    : customerSettings;
  const visibleAppointmentColumnCount =
    (isAdmin ? 1 : 0) +
    Number(appointmentColumnSettings.showAppointmentNumber) +
    Number(appointmentColumnSettings.showDeliveryDate) +
    Number(appointmentColumnSettings.showEffectivePallets) +
    Number(appointmentColumnSettings.showPod) +
    Number(appointmentColumnSettings.showBol);
  const appointmentGridStyle = {
    "--appointment-grid-template": getAppointmentGridTemplate(
      isAdmin,
      appointmentColumnSettings,
    ),
    "--appointment-grid-min-width": getAppointmentGridMinWidth(
      visibleAppointmentColumnCount,
    ),
  } as CSSProperties;
  const hasActiveFilters =
    Boolean(searchInput.trim() || search || selectedOperationMode || dateFrom || dateTo) ||
    pickupStatus !== "all";

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setSelectedOperationMode("");
    setDateField("orderDate");
    setDateFrom("");
    setDateTo("");
    setPickupStatus("all");
    setPage(1);
  }

  function refreshContainers() {
    setPage(1);
    setRefreshTick((value) => value + 1);
  }

  function resetCustomerScopedUi() {
    setPage(1);
    setContainers([]);
    setExpandedContainers(new Set());
    setExpandedWarehouseDetails(new Set());
    setTotalCount(0);
    setAllContainers(0);
    setPendingPickup(0);
    setPickedUp(0);
    setSearchInput("");
    setSearch("");
    setPickupStatus("all");
    setSelectedOperationMode("");
    setDateField("orderDate");
    setDateFrom("");
    setDateTo("");
    setEditingDateCell(null);
    setDateDraft("");
    setEditingAppointmentCell(null);
    setAppointmentDraft("");
    setAppointmentCellErrors({});
    setEditingWarehouseDetailCell(null);
    setWarehouseDetailDraft("");
    setWarehouseDetailCellErrors({});
  }

  async function handleSwitchCustomer() {
    if (!isAdmin || customerSwitchState === "loading") return;

    const targetCode = customerSwitchCode.trim();
    if (!targetCode || targetCode.toLowerCase() === customer?.code?.toLowerCase()) {
      return;
    }

    setCustomerSwitchState("loading");
    setCustomerSwitchMessage("");

    if (mockLongTable) {
      const nextCustomer =
        customerOptions.find(
          (option) => option.code?.toLowerCase() === targetCode.toLowerCase(),
        ) ?? null;
      if (nextCustomer) {
        setCustomer(nextCustomer);
        resetCustomerScopedUi();
        setRefreshTick((value) => value + 1);
        setCustomerSwitchState("idle");
      } else {
        setCustomerSwitchState("error");
        setCustomerSwitchMessage("客户不存在");
      }
      return;
    }

    try {
      const response = await fetch("/api/auth/switch-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: targetCode }),
      });
      const payload = (await response.json()) as {
        customer?: CustomerOption;
        error?: string;
      };

      if (!response.ok || !payload.customer) {
        throw new Error(payload.error ?? "客户切换失败");
      }

      setCustomer(payload.customer);
      setCustomerSwitchCode(payload.customer.code ?? "");
      setCustomerSwitchState("idle");
      resetCustomerScopedUi();
      setRefreshTick((value) => value + 1);
      setSyncStatusTick((value) => value + 1);
    } catch (switchError) {
      setCustomerSwitchState("error");
      setCustomerSwitchMessage(
        switchError instanceof Error ? switchError.message : "客户切换失败",
      );
    }
  }

  async function runSourceSync() {
    if (!isAdmin || syncActionState === "loading") return;

    setSyncActionState("loading");
    setSyncStatusMessage("正在同步源数据库");

    if (mockLongTable) {
      setSyncStatus({
        id: "mock-sync",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "success",
        customerCount: 108,
        containerCount: 4739,
        appointmentCount: 19274,
        message: null,
      });
      setSyncActionState("idle");
      setSyncStatusMessage("同步完成");
      refreshContainers();
      return;
    }

    try {
      const response = await fetch("/api/admin/sync", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? "同步失败");
      }

      setSyncActionState("idle");
      setSyncStatusMessage("同步完成，数据已刷新");
      setPage(1);
      setRefreshTick((value) => value + 1);
      setSyncStatusTick((value) => value + 1);
    } catch (syncError) {
      setSyncActionState("error");
      setSyncStatusMessage(
        syncError instanceof Error ? syncError.message : "同步失败",
      );
      setSyncStatusTick((value) => value + 1);
    }
  }

  async function handleSaveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const normalizedBalance = normalizeBalanceDraft(balanceDraft);
    if (!normalizedBalance) {
      setBalanceState("error");
      setBalanceMessage("请输入有效的美金金额");
      return;
    }

    setBalanceState("loading");
    setBalanceMessage("");

    if (mockLongTable) {
      const mockBalance = {
        balanceDueUsd: normalizedBalance,
        inventoryRemainingPallets: customerBalance?.inventoryRemainingPallets ?? 0,
        updatedAt: new Date().toISOString(),
      };
      setCustomerBalance(mockBalance);
      setBalanceDraft(mockBalance.balanceDueUsd);
      setBalanceState("idle");
      setBalanceMessage("已保存");
      return;
    }

    try {
      const response = await fetch("/api/customers/balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balanceDueUsd: normalizedBalance }),
      });
      const payload = (await response.json()) as {
        balance?: CustomerBalance;
        error?: string;
      };

      if (!response.ok || !payload.balance) {
        throw new Error(payload.error ?? "未结账款保存失败");
      }

      setCustomerBalance(payload.balance);
      setBalanceDraft(payload.balance.balanceDueUsd);
      setBalanceState("idle");
      setBalanceMessage("已保存");
    } catch (balanceError) {
      setBalanceState("error");
      setBalanceMessage(
        balanceError instanceof Error
          ? balanceError.message
          : "未结账款保存失败",
      );
    }
  }

  async function updateCustomerSetting(
    key: keyof CustomerVisibilitySettings,
    checked: boolean,
  ) {
    if (!isAdmin) return;

    const nextSettings = {
      ...customerSettings,
      [key]: checked,
    };
    const previousSettings = customerSettings;

    setCustomerSettings(nextSettings);
    setSettingsState("loading");
    setSettingsMessage("");

    if (mockLongTable) {
      setSettingsState("idle");
      setSettingsMessage("已保存");
      return;
    }

    try {
      const response = await fetch("/api/customers/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const payload = (await response.json()) as {
        settings?: CustomerVisibilitySettings;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "客户显示设置保存失败");
      }

      setCustomerSettings(payload.settings);
      setSettingsState("idle");
      setSettingsMessage("已保存");
    } catch (settingsError) {
      setCustomerSettings(previousSettings);
      setSettingsState("error");
      setSettingsMessage(
        settingsError instanceof Error
          ? settingsError.message
          : "客户显示设置保存失败",
      );
    }
  }

  function markDateCellSaving(key: string) {
    savingDateKeysRef.current.add(key);
    setSavingDateCells((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearDateCellSaving(key: string) {
    savingDateKeysRef.current.delete(key);
    const timeoutId = savingDateTimeoutsRef.current.get(key);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      savingDateTimeoutsRef.current.delete(key);
    }
    setSavingDateCells((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function clearAllDateSaving() {
    for (const timeoutId of savingDateTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    savingDateTimeoutsRef.current.clear();
    savingDateKeysRef.current.clear();
    setSavingDateCells(new Set());
  }

  function markAppointmentCellSaving(key: string) {
    savingAppointmentKeysRef.current.add(key);
    setSavingAppointmentCells((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearAppointmentCellSaving(key: string) {
    savingAppointmentKeysRef.current.delete(key);
    const timeoutId = savingAppointmentTimeoutsRef.current.get(key);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      savingAppointmentTimeoutsRef.current.delete(key);
    }
    setSavingAppointmentCells((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function clearAllAppointmentSaving() {
    for (const timeoutId of savingAppointmentTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    savingAppointmentTimeoutsRef.current.clear();
    savingAppointmentKeysRef.current.clear();
    setSavingAppointmentCells(new Set());
  }

  function markAppointmentDocumentSaving(key: string) {
    savingAppointmentDocumentKeysRef.current.add(key);
    setSavingAppointmentDocuments((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearAppointmentDocumentSaving(key: string) {
    savingAppointmentDocumentKeysRef.current.delete(key);
    setSavingAppointmentDocuments((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function markAppointmentVisibilitySaving(key: string) {
    savingAppointmentVisibilityKeysRef.current.add(key);
    setSavingAppointmentVisibility((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearAppointmentVisibilitySaving(key: string) {
    savingAppointmentVisibilityKeysRef.current.delete(key);
    setSavingAppointmentVisibility((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function markTextCellSaving(key: string) {
    savingTextCellKeysRef.current.add(key);
    setSavingTextCells((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearTextCellSaving(key: string) {
    savingTextCellKeysRef.current.delete(key);
    setSavingTextCells((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function markContainerBillSaving(key: string) {
    savingContainerBillKeysRef.current.add(key);
    setSavingContainerBills((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearContainerBillSaving(key: string) {
    savingContainerBillKeysRef.current.delete(key);
    setSavingContainerBills((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function markWarehouseDetailCellSaving(key: string) {
    savingWarehouseDetailKeysRef.current.add(key);
    setSavingWarehouseDetailCells((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function clearWarehouseDetailCellSaving(key: string) {
    savingWarehouseDetailKeysRef.current.delete(key);
    const timeoutId = savingWarehouseDetailTimeoutsRef.current.get(key);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      savingWarehouseDetailTimeoutsRef.current.delete(key);
    }
    setSavingWarehouseDetailCells((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function clearAllWarehouseDetailSaving() {
    for (const timeoutId of savingWarehouseDetailTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    savingWarehouseDetailTimeoutsRef.current.clear();
    savingWarehouseDetailKeysRef.current.clear();
    setSavingWarehouseDetailCells(new Set());
  }

  function startDateEdit(container: TableContainerRecord, field: EditableDateField) {
    const key = getDateCellKey(container.rowId, field);
    if (savingDateKeysRef.current.has(key)) return;

    setEditingDateCell({ rowId: container.rowId, field });
    setDateDraft(container[field] ?? "");
    setDateCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function cancelDateEdit() {
    setEditingDateCell(null);
    setDateDraft("");
  }

  async function commitDateEdit(
    container: TableContainerRecord,
    field: EditableDateField,
    value = dateDraft,
  ) {
    const key = getDateCellKey(container.rowId, field);
    if (savingDateKeysRef.current.has(key)) return;

    const nextValue = value.trim() || null;
    const currentValue = container[field] ?? null;

    if (nextValue && !isValidEditableDateInput(nextValue)) {
      setDateCellErrors((current) => ({
        ...current,
        [key]: "请输入有效日期",
      }));
      return;
    }

    setEditingDateCell(null);
    setDateDraft("");

    if (nextValue === currentValue) return;

    markDateCellSaving(key);
    setDateCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    if (mockLongTable) {
      const updatedDates: Partial<Pick<ContainerRecord, EditableDateField>> = {
        [field]: nextValue,
      };
      applyUpdatedDateFields(container, updatedDates);
      clearDateCellSaving(key);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
        clearDateCellSaving(key);
        setDateCellErrors((current) => ({
          ...current,
          [key]: "保存超时，请重试",
        }));
      }, 10000);
      savingDateTimeoutsRef.current.set(key, timeoutId);

      const response = await fetch("/api/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sourceOrderId: container.sourceOrderId,
          field,
          value: nextValue,
        }),
      });
      const payload = (await response.json()) as {
        dates?: Partial<Pick<ContainerRecord, EditableDateField>>;
        error?: string;
      };

      if (!response.ok || !payload.dates) {
        throw new Error(payload.error ?? "保存失败");
      }

      applyUpdatedDateFields(container, payload.dates);
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") {
        return;
      }

      setDateCellErrors((current) => ({
        ...current,
        [key]: saveError instanceof Error ? saveError.message : "保存失败",
      }));
    } finally {
      clearDateCellSaving(key);
    }
  }

  function applyUpdatedDateFields(
    original: TableContainerRecord,
    dates: Partial<Pick<ContainerRecord, EditableDateField>>,
  ) {
    const updatedPickupDate =
      hasDateField(dates, "pickupDate")
        ? dates.pickupDate ?? null
        : original.pickupDate;
    const wasPickedUp = Boolean(original.pickupDate);
    const isPickedUp = Boolean(updatedPickupDate);
    const shouldRemoveFromStatus =
      (pickupStatus === "pending" && isPickedUp) ||
      (pickupStatus === "picked" && !isPickedUp);

    setContainers((current) =>
      current
        .map((row) =>
          row.rowId === original.rowId
            ? {
                ...row,
                ...dates,
                orderDate: hasDateField(dates, "orderDate")
                  ? dates.orderDate ?? null
                  : row.orderDate,
                etaDate: hasDateField(dates, "etaDate")
                  ? dates.etaDate ?? null
                  : row.etaDate,
                lfdDate: hasDateField(dates, "lfdDate")
                  ? dates.lfdDate ?? null
                  : row.lfdDate,
                pickupDate: hasDateField(dates, "pickupDate")
                  ? dates.pickupDate ?? null
                  : row.pickupDate,
              }
            : row,
        )
        .filter(
          (row) => row.rowId !== original.rowId || !shouldRemoveFromStatus,
        ),
    );

    if (wasPickedUp !== isPickedUp) {
      setPendingPickup((value) =>
        Math.max(0, value + (isPickedUp ? -1 : 1)),
      );
      setPickedUp((value) => Math.max(0, value + (isPickedUp ? 1 : -1)));
      if (shouldRemoveFromStatus) {
        setTotalCount((value) => Math.max(0, value - 1));
      }
    }
  }

  function startWarehouseDetailEdit(
    container: TableContainerRecord,
    warehouseDetail: WarehouseDetail,
    field: EditableWarehouseDetailField,
  ) {
    const key = getWarehouseDetailCellKey(
      container.rowId,
      warehouseDetail.sourceOrderDetailId,
      field,
    );
    if (savingWarehouseDetailKeysRef.current.has(key)) return;

    setEditingWarehouseDetailCell({
      rowId: container.rowId,
      sourceOrderDetailId: warehouseDetail.sourceOrderDetailId,
      field,
    });
    setWarehouseDetailDraft(getWarehouseDetailDraftValue(warehouseDetail, field));
    setWarehouseDetailCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function cancelWarehouseDetailEdit() {
    setEditingWarehouseDetailCell(null);
    setWarehouseDetailDraft("");
  }

  async function commitWarehouseDetailEdit(
    container: TableContainerRecord,
    warehouseDetail: WarehouseDetail,
    field: EditableWarehouseDetailField,
    value = warehouseDetailDraft,
  ) {
    const key = getWarehouseDetailCellKey(
      container.rowId,
      warehouseDetail.sourceOrderDetailId,
      field,
    );
    if (savingWarehouseDetailKeysRef.current.has(key)) return;

    const nextValue = value.trim();
    const currentValue = getWarehouseDetailDraftValue(warehouseDetail, field);
    if (nextValue === currentValue) {
      cancelWarehouseDetailEdit();
      return;
    }

    const validationError = validateWarehouseDetailDraft(field, nextValue);
    if (validationError) {
      setWarehouseDetailCellErrors((current) => ({
        ...current,
        [key]: validationError,
      }));
      return;
    }

    setEditingWarehouseDetailCell(null);
    setWarehouseDetailDraft("");
    markWarehouseDetailCellSaving(key);

    if (mockLongTable) {
      applyUpdatedWarehouseDetail(container, warehouseDetail.sourceOrderDetailId, {
        sourceOrderDetailId: warehouseDetail.sourceOrderDetailId,
        [field]: coerceWarehouseDetailValue(field, nextValue),
      });
      clearWarehouseDetailCellSaving(key);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
        clearWarehouseDetailCellSaving(key);
        setWarehouseDetailCellErrors((current) => ({
          ...current,
          [key]: "保存超时，请重试",
        }));
      }, 10000);
      savingWarehouseDetailTimeoutsRef.current.set(key, timeoutId);

      const response = await fetch("/api/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind: "warehouseDetail",
          sourceOrderId: container.sourceOrderId,
          sourceOrderDetailId: warehouseDetail.sourceOrderDetailId,
          field,
          value: nextValue || null,
        }),
      });
      const payload = (await response.json()) as {
        warehouseDetail?: Pick<
          WarehouseDetail,
          "sourceOrderDetailId" | "actualPallets"
        >;
        error?: string;
      };

      if (!response.ok || !payload.warehouseDetail) {
        throw new Error(payload.error ?? "保存失败");
      }

      applyUpdatedWarehouseDetail(
        container,
        warehouseDetail.sourceOrderDetailId,
        payload.warehouseDetail,
      );
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") {
        return;
      }

      setWarehouseDetailCellErrors((current) => ({
        ...current,
        [key]: saveError instanceof Error ? saveError.message : "保存失败",
      }));
    } finally {
      clearWarehouseDetailCellSaving(key);
    }
  }

  function applyUpdatedWarehouseDetail(
    original: TableContainerRecord,
    sourceOrderDetailId: string,
    updatedDetail: Pick<WarehouseDetail, "sourceOrderDetailId" | "actualPallets">,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              warehouseDetails: row.warehouseDetails.map((detail) =>
                detail.sourceOrderDetailId === sourceOrderDetailId
                  ? {
                      ...detail,
                      actualPallets: updatedDetail.actualPallets,
                    }
                  : detail,
              ),
            }
          : row,
      ),
    );
  }

  function startAppointmentEdit(
    container: TableContainerRecord,
    warehouseDetail: WarehouseDetail,
    appointment: WarehouseAppointment,
    field: EditableWarehouseAppointmentField,
  ) {
    const sourceOrderDetailId =
      appointment.sourceOrderDetailId || warehouseDetail.sourceOrderDetailId;
    const key = getAppointmentCellKey(
      container.rowId,
      sourceOrderDetailId,
      appointment.sourceAppointmentLineId,
      field,
    );
    if (savingAppointmentKeysRef.current.has(key)) return;

    setEditingAppointmentCell({
      rowId: container.rowId,
      sourceOrderDetailId,
      sourceAppointmentLineId: appointment.sourceAppointmentLineId,
      field,
    });
    setAppointmentDraft(getAppointmentDraftValue(appointment, field));
    setAppointmentCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function cancelAppointmentEdit() {
    setEditingAppointmentCell(null);
    setAppointmentDraft("");
  }

  async function commitAppointmentEdit(
    container: TableContainerRecord,
    warehouseDetail: WarehouseDetail,
    appointment: WarehouseAppointment,
    field: EditableWarehouseAppointmentField,
    value = appointmentDraft,
  ) {
    const sourceOrderDetailId =
      appointment.sourceOrderDetailId || warehouseDetail.sourceOrderDetailId;
    const key = getAppointmentCellKey(
      container.rowId,
      sourceOrderDetailId,
      appointment.sourceAppointmentLineId,
      field,
    );
    if (savingAppointmentKeysRef.current.has(key)) return;

    const nextValue = value.trim();
    const currentValue = getAppointmentDraftValue(appointment, field);
    if (nextValue === currentValue) {
      cancelAppointmentEdit();
      return;
    }

    const validationError = validateAppointmentDraft(field, nextValue);
    if (validationError) {
      setAppointmentCellErrors((current) => ({
        ...current,
        [key]: validationError,
      }));
      return;
    }

    setEditingAppointmentCell(null);
    setAppointmentDraft("");
    markAppointmentCellSaving(key);

    if (mockLongTable) {
      applyUpdatedAppointment(
        container,
        sourceOrderDetailId,
        appointment.sourceAppointmentLineId,
        {
          ...appointment,
          [field]: coerceAppointmentValue(field, nextValue),
        },
      );
      clearAppointmentCellSaving(key);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
        clearAppointmentCellSaving(key);
        setAppointmentCellErrors((current) => ({
          ...current,
          [key]: "保存超时，请重试",
        }));
      }, 10000);
      savingAppointmentTimeoutsRef.current.set(key, timeoutId);
      const isLegacyAppointment =
        appointment.sourceAppointmentLineId.startsWith("legacy:");
      const requestBody = isLegacyAppointment
        ? {
            kind: "appointment",
            sourceOrderId: container.sourceOrderId,
            sourceAppointmentId: appointment.sourceAppointmentId,
            field: mapLegacyAppointmentField(field),
            value:
              field === "deliveryDate" && nextValue
                ? `${nextValue} 00:00`
                : nextValue || null,
          }
        : {
            kind: "warehouseAppointment",
            sourceOrderId: container.sourceOrderId,
            sourceOrderDetailId,
            sourceAppointmentLineId: appointment.sourceAppointmentLineId,
            field,
            value: nextValue || null,
          };

      const response = await fetch("/api/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });
      const payload = (await response.json()) as {
        warehouseAppointment?: WarehouseAppointment;
        appointment?: DeliveryAppointment;
        error?: string;
      };
      const updatedAppointment =
        payload.warehouseAppointment ??
        (payload.appointment
          ? legacyAppointmentToWarehouseAppointment(payload.appointment)
          : null);

      if (!response.ok || !updatedAppointment) {
        throw new Error(payload.error ?? "保存失败");
      }

      applyUpdatedAppointment(
        container,
        sourceOrderDetailId,
        appointment.sourceAppointmentLineId,
        updatedAppointment,
      );
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") {
        return;
      }

      setAppointmentCellErrors((current) => ({
        ...current,
        [key]: saveError instanceof Error ? saveError.message : "保存失败",
      }));
    } finally {
      clearAppointmentCellSaving(key);
    }
  }

  function applyUpdatedAppointment(
    original: TableContainerRecord,
    sourceOrderDetailId: string,
    sourceAppointmentLineId: string,
    updatedAppointment: WarehouseAppointment,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              warehouseDetails: row.warehouseDetails.map((detail) =>
                detail.sourceOrderDetailId === sourceOrderDetailId ||
                detail.appointments.some(
                  (appointment) =>
                    appointment.sourceAppointmentLineId ===
                    sourceAppointmentLineId,
                )
                  ? {
                      ...detail,
                      appointments: detail.appointments.map((appointment) =>
                        appointment.sourceAppointmentLineId ===
                        sourceAppointmentLineId
                          ? mergeAppointmentUpdate(
                              appointment,
                              updatedAppointment,
                            )
                          : appointment,
                      ),
                    }
                  : detail,
              ),
            }
          : row,
      ),
    );
  }

  async function commitAppointmentVisibility(
    container: TableContainerRecord,
    warehouseDetail: WarehouseDetail,
    appointment: WarehouseAppointment,
  ) {
    if (!isAdmin || !canSelectAppointmentVisibility(appointment)) return;

    const sourceOrderDetailId =
      appointment.sourceOrderDetailId || warehouseDetail.sourceOrderDetailId;
    const key = getAppointmentVisibilityKey(
      container.rowId,
      sourceOrderDetailId,
    );

    if (savingAppointmentVisibilityKeysRef.current.has(key)) return;
    if (appointment.isCustomerVisible) return;

    markAppointmentVisibilitySaving(key);
    setAppointmentVisibilityErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    if (mockLongTable) {
      applyUpdatedAppointmentVisibility(
        container,
        sourceOrderDetailId,
        appointment.sourceAppointmentLineId,
      );
      clearAppointmentVisibilitySaving(key);
      return;
    }

    try {
      const response = await fetch("/api/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "warehouseAppointmentVisibility",
          sourceOrderId: container.sourceOrderId,
          sourceOrderDetailId,
          sourceAppointmentLineId: appointment.sourceAppointmentLineId,
        }),
      });
      const payload = (await response.json()) as {
        warehouseAppointmentVisibility?: {
          sourceOrderDetailId: string;
          sourceAppointmentLineId: string | null;
        };
        error?: string;
      };

      if (!response.ok || !payload.warehouseAppointmentVisibility) {
        throw new Error(payload.error ?? "保存失败");
      }

      applyUpdatedAppointmentVisibility(
        container,
        payload.warehouseAppointmentVisibility.sourceOrderDetailId,
        payload.warehouseAppointmentVisibility.sourceAppointmentLineId,
      );
    } catch (saveError) {
      setAppointmentVisibilityErrors((current) => ({
        ...current,
        [key]: saveError instanceof Error ? saveError.message : "保存失败",
      }));
    } finally {
      clearAppointmentVisibilitySaving(key);
    }
  }

  function applyUpdatedAppointmentVisibility(
    original: TableContainerRecord,
    sourceOrderDetailId: string,
    sourceAppointmentLineId: string | null,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              warehouseDetails: row.warehouseDetails.map((detail) => ({
                ...detail,
                appointments: detail.appointments.map((appointment) =>
                  appointment.sourceOrderDetailId === sourceOrderDetailId
                    ? {
                        ...appointment,
                        isCustomerVisible:
                          appointment.sourceAppointmentLineId ===
                          sourceAppointmentLineId,
                      }
                    : appointment,
                ),
              })),
            }
          : row,
      ),
    );
  }

  async function commitContainerExtraCharge(
    container: TableContainerRecord,
    value: string,
  ) {
    const key = getContainerTextKey(container.rowId, "extraChargeResponsibility");
    if (!isAdmin || savingTextCellKeysRef.current.has(key)) return;

    const nextValue = normalizeTextDraft(value);
    if (nextValue === (container.extraChargeResponsibility ?? null)) return;

    markTextCellSaving(key);
    setTextCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    if (mockLongTable) {
      applyUpdatedContainerText(container, nextValue);
      clearTextCellSaving(key);
      return;
    }

    try {
      const response = await fetch("/api/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "containerText",
          sourceOrderId: container.sourceOrderId,
          field: "extraChargeResponsibility",
          value: nextValue,
        }),
      });
      const payload = (await response.json()) as {
        containerText?: Pick<
          ContainerRecord,
          "sourceOrderId" | "extraChargeResponsibility"
        >;
        error?: string;
      };

      if (!response.ok || !payload.containerText) {
        throw new Error(payload.error ?? "保存失败");
      }

      applyUpdatedContainerText(
        container,
        payload.containerText.extraChargeResponsibility ?? null,
      );
    } catch (saveError) {
      setTextCellErrors((current) => ({
        ...current,
        [key]: saveError instanceof Error ? saveError.message : "保存失败",
      }));
    } finally {
      clearTextCellSaving(key);
    }
  }

  function applyUpdatedContainerText(
    original: TableContainerRecord,
    extraChargeResponsibility: string | null,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              extraChargeResponsibility,
            }
          : row,
      ),
    );
  }

  async function commitWarehouseCustomerNote(
    container: TableContainerRecord,
    warehouseDetail: WarehouseDetail,
    value: string,
  ) {
    const key = getWarehouseDetailTextKey(
      container.rowId,
      warehouseDetail.sourceOrderDetailId,
      "customerNote",
    );
    if (!isAdmin || savingTextCellKeysRef.current.has(key)) return;

    const nextValue = normalizeTextDraft(value);
    if (nextValue === (warehouseDetail.customerNote ?? null)) return;

    markTextCellSaving(key);
    setTextCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    if (mockLongTable) {
      applyUpdatedWarehouseDetailText(
        container,
        warehouseDetail.sourceOrderDetailId,
        nextValue,
      );
      clearTextCellSaving(key);
      return;
    }

    try {
      const response = await fetch("/api/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "warehouseDetailText",
          sourceOrderId: container.sourceOrderId,
          sourceOrderDetailId: warehouseDetail.sourceOrderDetailId,
          field: "customerNote",
          value: nextValue,
        }),
      });
      const payload = (await response.json()) as {
        warehouseDetailText?: Pick<
          WarehouseDetail,
          "sourceOrderDetailId" | "customerNote"
        >;
        error?: string;
      };

      if (!response.ok || !payload.warehouseDetailText) {
        throw new Error(payload.error ?? "保存失败");
      }

      applyUpdatedWarehouseDetailText(
        container,
        payload.warehouseDetailText.sourceOrderDetailId,
        payload.warehouseDetailText.customerNote ?? null,
      );
    } catch (saveError) {
      setTextCellErrors((current) => ({
        ...current,
        [key]: saveError instanceof Error ? saveError.message : "保存失败",
      }));
    } finally {
      clearTextCellSaving(key);
    }
  }

  function applyUpdatedWarehouseDetailText(
    original: TableContainerRecord,
    sourceOrderDetailId: string,
    customerNote: string | null,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              warehouseDetails: row.warehouseDetails.map((detail) =>
                detail.sourceOrderDetailId === sourceOrderDetailId
                  ? {
                      ...detail,
                      customerNote,
                    }
                  : detail,
              ),
            }
          : row,
      ),
    );
  }

  async function uploadAppointmentDocument({
    container,
    warehouseDetail,
    appointment,
    documentType,
    file,
  }: {
    container: TableContainerRecord;
    warehouseDetail: WarehouseDetail;
    appointment: WarehouseAppointment;
    documentType: AppointmentDocumentType;
    file: File;
  }) {
    const sourceOrderDetailId =
      appointment.sourceOrderDetailId || warehouseDetail.sourceOrderDetailId;
    const key = getAppointmentDocumentKey(
      container.rowId,
      sourceOrderDetailId,
      appointment.sourceAppointmentLineId,
      documentType,
    );
    if (savingAppointmentDocumentKeysRef.current.has(key)) return;

    const validationError = validateDocumentFile(file);
    if (validationError) {
      setAppointmentDocumentErrors((current) => ({
        ...current,
        [key]: validationError,
      }));
      return;
    }

    if (mockLongTable) {
      applyUpdatedAppointmentDocument(
        container,
        sourceOrderDetailId,
        appointment.sourceAppointmentLineId,
        documentType,
        {
          hasFile: true,
          fileName: file.name || "document",
          mimeType: file.type || guessDocumentMimeType(file.name),
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        },
      );
      return;
    }

    markAppointmentDocumentSaving(key);
    setAppointmentDocumentErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    try {
      const formData = new FormData();
      formData.set("sourceOrderId", container.sourceOrderId);
      formData.set("sourceOrderDetailId", sourceOrderDetailId);
      formData.set(
        "sourceAppointmentLineId",
        appointment.sourceAppointmentLineId,
      );
      formData.set("documentType", documentType);
      formData.set("file", file);

      const response = await fetch("/api/containers/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        document?: AppointmentDocumentMeta;
        error?: string;
      };

      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "上传失败");
      }

      applyUpdatedAppointmentDocument(
        container,
        sourceOrderDetailId,
        appointment.sourceAppointmentLineId,
        documentType,
        payload.document,
      );
    } catch (uploadError) {
      setAppointmentDocumentErrors((current) => ({
        ...current,
        [key]: uploadError instanceof Error ? uploadError.message : "上传失败",
      }));
    } finally {
      clearAppointmentDocumentSaving(key);
    }
  }

  function applyUpdatedAppointmentDocument(
    original: TableContainerRecord,
    sourceOrderDetailId: string,
    sourceAppointmentLineId: string,
    documentType: AppointmentDocumentType,
    document: AppointmentDocumentMeta,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              warehouseDetails: row.warehouseDetails.map((detail) =>
                detail.sourceOrderDetailId === sourceOrderDetailId ||
                detail.appointments.some(
                  (appointment) =>
                    appointment.sourceAppointmentLineId ===
                    sourceAppointmentLineId,
                )
                  ? {
                      ...detail,
                      appointments: detail.appointments.map((appointment) =>
                        appointment.sourceAppointmentLineId ===
                        sourceAppointmentLineId
                          ? {
                              ...appointment,
                              sourceOrderDetailId:
                                appointment.sourceOrderDetailId ||
                                sourceOrderDetailId,
                              [documentType === "pod"
                                ? "podDocument"
                                : "bolDocument"]: document,
                            }
                          : appointment,
                      ),
                    }
                  : detail,
              ),
            }
          : row,
      ),
    );
  }

  async function uploadContainerBill({
    container,
    file,
  }: {
    container: TableContainerRecord;
    file: File;
  }) {
    const key = getContainerBillKey(container.rowId);
    if (savingContainerBillKeysRef.current.has(key)) return;

    const validationError = validateDocumentFile(file);
    if (validationError) {
      setContainerBillErrors((current) => ({
        ...current,
        [key]: validationError,
      }));
      return;
    }

    if (mockLongTable) {
      applyUpdatedContainerBill(container, {
        hasFile: true,
        fileName: file.name || "bill",
        mimeType: file.type || guessDocumentMimeType(file.name),
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      });
      return;
    }

    markContainerBillSaving(key);
    setContainerBillErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    try {
      const formData = new FormData();
      formData.set("sourceOrderId", container.sourceOrderId);
      formData.set("file", file);

      const response = await fetch("/api/containers/bills", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        document?: AppointmentDocumentMeta;
        error?: string;
      };

      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "上传账单失败");
      }

      applyUpdatedContainerBill(container, payload.document);
    } catch (uploadError) {
      setContainerBillErrors((current) => ({
        ...current,
        [key]:
          uploadError instanceof Error ? uploadError.message : "上传账单失败",
      }));
    } finally {
      clearContainerBillSaving(key);
    }
  }

  function applyUpdatedContainerBill(
    original: TableContainerRecord,
    document: AppointmentDocumentMeta,
  ) {
    setContainers((current) =>
      current.map((row) =>
        row.rowId === original.rowId
          ? {
              ...row,
              billDocument: document,
            }
          : row,
      ),
    );
  }

  const columns: ColumnDef<TableContainerRecord>[] = [
      {
        id: "rowDrag",
        header: "",
        size: 46,
        minSize: 44,
        maxSize: 52,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) =>
          isAdmin ? (
            <div className="dragCell">
              <button
                type="button"
                className={[
                  "tableIconButton",
                  "dragHandle",
                  draggedRowId === row.original.rowId ? "isActive" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={draggedRowId === row.original.rowId}
                aria-label={`拖拽调整 ${row.original.containerNumber} 行位置`}
                title="按住拖拽换行"
                onPointerDown={(event) =>
                  handleRowDragPointerDown(event, row.original.rowId)
                }
              >
                <GripVertical size={16} aria-hidden="true" />
              </button>
            </div>
          ) : null,
      },
      {
        id: "expand",
        header: "",
        size: 40,
        minSize: 36,
        maxSize: 44,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => {
          const isExpanded = expandedContainers.has(row.original.rowId);

          return (
            <div className="expandCell">
              <button
                type="button"
                className="tableIconButton expandIconButton"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "收起详情" : "展开详情"}
                title={isExpanded ? "收起详情" : "展开详情"}
                onClick={() => toggleContainer(row.original.rowId)}
              >
                <ChevronRight
                  className={isExpanded ? "chevronIcon expanded" : "chevronIcon"}
                  size={15}
                  aria-hidden="true"
                />
              </button>
            </div>
          );
        },
      },
      {
        id: "rowNumber",
        header: "",
        size: 44,
        minSize: 44,
        maxSize: 52,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <span className="rowIndex">
            {(page - 1) * PAGE_SIZE + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: "containerNumber",
        header: "柜号",
        size: 150,
        minSize: 140,
        maxSize: 190,
        cell: ({ row, getValue }) => {
          const containerNumber = String(getValue());

          return (
            <div className="containerCell">
              <TruncatedText className="containerTitle" text={containerNumber} />
              <button
                type="button"
                className="copyButton"
                aria-label={`复制柜号 ${containerNumber}`}
                title={copiedContainer === row.original.rowId ? "已复制" : "复制柜号"}
                onClick={(event) => {
                  event.stopPropagation();
                  copyContainerNumber(containerNumber, row.original.rowId);
                }}
              >
                <Copy size={14} aria-hidden="true" />
              </button>
            </div>
          );
        },
      },
      {
        id: "orderDate",
        accessorFn: (row) => toDateSortValue(row.orderDate),
        header: "订单日期",
        size: 112,
        minSize: 104,
        sortingFn: dateSorting,
        cell: ({ row }) =>
          isAdmin ? (
            <EditableDateCell
              container={row.original}
              field="orderDate"
              isEditing={
                editingDateCell?.rowId === row.original.rowId &&
                editingDateCell.field === "orderDate"
              }
              draft={dateDraft}
              error={dateCellErrors[getDateCellKey(row.original.rowId, "orderDate")]}
              isSaving={
                savingDateCells.has(getDateCellKey(row.original.rowId, "orderDate"))
              }
              onCancel={cancelDateEdit}
              onCommit={(value) => commitDateEdit(row.original, "orderDate", value)}
              onDraftChange={setDateDraft}
              onStart={() => startDateEdit(row.original, "orderDate")}
            />
          ) : (
            <DateValue value={row.original.orderDate} />
          ),
      },
      {
        id: "etaDate",
        accessorFn: (row) => toDateSortValue(row.etaDate),
        header: "ETA",
        size: 104,
        minSize: 96,
        sortingFn: dateSorting,
        cell: ({ row }) =>
          isAdmin ? (
            <EditableDateCell
              container={row.original}
              field="etaDate"
              isEditing={
                editingDateCell?.rowId === row.original.rowId &&
                editingDateCell.field === "etaDate"
              }
              draft={dateDraft}
              error={dateCellErrors[getDateCellKey(row.original.rowId, "etaDate")]}
              isSaving={
                savingDateCells.has(getDateCellKey(row.original.rowId, "etaDate"))
              }
              onCancel={cancelDateEdit}
              onCommit={(value) => commitDateEdit(row.original, "etaDate", value)}
              onDraftChange={setDateDraft}
              onStart={() => startDateEdit(row.original, "etaDate")}
            />
          ) : (
            <DateValue value={row.original.etaDate} />
          ),
      },
      {
        id: "lfdDate",
        accessorFn: (row) => toDateSortValue(row.lfdDate),
        header: "LFD",
        size: 104,
        minSize: 96,
        sortingFn: dateSorting,
        cell: ({ row }) =>
          isAdmin ? (
            <EditableDateCell
              container={row.original}
              field="lfdDate"
              isEditing={
                editingDateCell?.rowId === row.original.rowId &&
                editingDateCell.field === "lfdDate"
              }
              draft={dateDraft}
              error={dateCellErrors[getDateCellKey(row.original.rowId, "lfdDate")]}
              isSaving={
                savingDateCells.has(getDateCellKey(row.original.rowId, "lfdDate"))
              }
              onCancel={cancelDateEdit}
              onCommit={(value) => commitDateEdit(row.original, "lfdDate", value)}
              onDraftChange={setDateDraft}
              onStart={() => startDateEdit(row.original, "lfdDate")}
            />
          ) : (
            <DateValue value={row.original.lfdDate} />
          ),
      },
      {
        id: "pickupDate",
        accessorFn: (row) => toDateSortValue(row.pickupDate),
        header: "提柜日期",
        size: 112,
        minSize: 104,
        sortingFn: dateSorting,
        cell: ({ row }) =>
          isAdmin ? (
            <EditableDateCell
              container={row.original}
              field="pickupDate"
              isEditing={
                editingDateCell?.rowId === row.original.rowId &&
                editingDateCell.field === "pickupDate"
              }
              draft={dateDraft}
              error={dateCellErrors[getDateCellKey(row.original.rowId, "pickupDate")]}
              isSaving={
                savingDateCells.has(getDateCellKey(row.original.rowId, "pickupDate"))
              }
              onCancel={cancelDateEdit}
              onCommit={(value) => commitDateEdit(row.original, "pickupDate", value)}
              onDraftChange={setDateDraft}
              onStart={() => startDateEdit(row.original, "pickupDate")}
            />
          ) : (
            <DateValue value={row.original.pickupDate} />
          ),
      },
      {
        accessorKey: "operationModeLabel",
        header: "操作方式",
        size: 92,
        minSize: 84,
        cell: ({ row }) => (
          <span className={`pill ${row.original.operationMode ?? ""}`}>
            {row.original.operationModeLabel}
          </span>
        ),
      },
      {
        id: "location",
        header: "目的地/仓点",
        accessorFn: (row) => getLocationText(row) ?? "",
        size: 248,
        minSize: 200,
        maxSize: 320,
        cell: ({ row }) => (
          <LocationCell value={getLocationText(row.original)} />
        ),
      },
      {
        id: "bill",
        header: "账单",
        size: 132,
        minSize: 122,
        maxSize: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <ContainerBillCell
            container={row.original}
            document={row.original.billDocument}
            error={containerBillErrors[getContainerBillKey(row.original.rowId)]}
            isAdmin={isAdmin}
            isUploading={savingContainerBills.has(
              getContainerBillKey(row.original.rowId),
            )}
            onUpload={(file) =>
              uploadContainerBill({
                container: row.original,
                file,
              })
            }
          />
        ),
      },
      {
        id: "extraChargeResponsibility",
        header: "额外费用责任",
        size: 220,
        minSize: 180,
        maxSize: 340,
        enableSorting: false,
        cell: ({ row }) => {
          const key = getContainerTextKey(
            row.original.rowId,
            "extraChargeResponsibility",
          );

          return (
            <InlineEditableTextCell
              className="extraChargeCell"
              error={textCellErrors[key]}
              isSaving={savingTextCells.has(key)}
              label="额外产生费用及责任"
              onCommit={(value) =>
                commitContainerExtraCharge(row.original, value)
              }
              placeholder="填写费用或责任"
              readOnly={!isAdmin}
              value={row.original.extraChargeResponsibility}
            />
          );
        },
      },
    ];

  const table = useReactTable({
    data: containers,
    columns,
    state: {
      sorting,
      columnSizing,
    },
    columnResizeMode: "onChange",
    getRowId: (row) => row.rowId,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  function toggleContainer(rowId: string) {
    setExpandedContainers((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
        setExpandedWarehouseDetails((details) => {
          const detailNext = new Set(details);
          for (const key of detailNext) {
            if (key.startsWith(`${rowId}:`)) detailNext.delete(key);
          }
          return detailNext;
        });
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function toggleWarehouseDetail(rowId: string, sourceOrderDetailId: string) {
    const key = getWarehouseDetailKey(rowId, sourceOrderDetailId);
    setExpandedWarehouseDetails((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleRowDragPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    rowId: string,
  ) {
    if (!isAdmin) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    cleanupRowDrag();
    rowDragSessionRef.current = {
      sourceRowId: rowId,
      targetRowId: null,
      rafId: null,
    };
    document.body.classList.add("rowDragActive");
    setDraggedRowId(rowId);
    setDragOverRowId(null);

    const moveListener = (nativeEvent: globalThis.PointerEvent) => {
      nativeEvent.preventDefault();
      updateRowDragTarget(nativeEvent.clientX, nativeEvent.clientY);
      autoScrollDuringRowDrag(nativeEvent.clientY);
    };
    const upListener = (nativeEvent: globalThis.PointerEvent) => {
      nativeEvent.preventDefault();
      finishRowDrag();
    };

    window.addEventListener("pointermove", moveListener, { passive: false });
    window.addEventListener("pointerup", upListener, { passive: false });
    window.addEventListener("pointercancel", upListener, { passive: false });
    rowDragCleanupRef.current = () => {
      window.removeEventListener("pointermove", moveListener);
      window.removeEventListener("pointerup", upListener);
      window.removeEventListener("pointercancel", upListener);
    };
  }

  function updateRowDragTarget(clientX: number, clientY: number) {
    const session = rowDragSessionRef.current;
    if (!session) return;

    const targetRowId = getRowIdAtPoint(clientX, clientY);
    session.targetRowId =
      targetRowId && targetRowId !== session.sourceRowId ? targetRowId : null;

    if (session.rafId !== null) return;

    session.rafId = window.requestAnimationFrame(() => {
      const current = rowDragSessionRef.current;
      if (!current) return;

      setDragOverRowId(current.targetRowId);
      current.rafId = null;
    });
  }

  function finishRowDrag() {
    const session = rowDragSessionRef.current;
    const sourceRowId = session?.sourceRowId;
    const targetRowId = session?.targetRowId;

    if (sourceRowId && targetRowId && sourceRowId !== targetRowId) {
      reorderVisibleRows(sourceRowId, targetRowId);
    }

    cleanupRowDrag();
  }

  function cleanupRowDrag() {
    rowDragCleanupRef.current?.();
    rowDragCleanupRef.current = null;
    const session = rowDragSessionRef.current;

    if (session?.rafId !== null && session?.rafId !== undefined) {
      window.cancelAnimationFrame(session.rafId);
    }

    rowDragSessionRef.current = null;
    document.body.classList.remove("rowDragActive");
    setDraggedRowId(null);
    setDragOverRowId(null);
  }

  function reorderVisibleRows(sourceRowId: string, targetRowId: string) {
    if (sourceRowId === targetRowId) return;

    const visibleRowIds = table.getRowModel().rows.map((row) => row.id);
    const sourceIndex = visibleRowIds.indexOf(sourceRowId);
    const targetIndex = visibleRowIds.indexOf(targetRowId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const reorderedVisibleRowIds = moveArrayItem(
      visibleRowIds,
      sourceIndex,
      targetIndex,
    );
    const visibleRowIdSet = new Set(visibleRowIds);

    setContainers((current) => {
      const rowsById = new Map(current.map((container) => [container.rowId, container]));
      let visibleIndex = 0;

      return current.map((container) => {
        if (!visibleRowIdSet.has(container.rowId)) return container;
        const nextRowId = reorderedVisibleRowIds[visibleIndex];
        visibleIndex += 1;
        return rowsById.get(nextRowId) ?? container;
      });
    });
    setSorting([]);
  }

  function getRowIdAtPoint(clientX: number, clientY: number) {
    const row = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLTableRowElement>("tr[data-row-id]");

    if (row?.dataset.rowId) return row.dataset.rowId;

    let closestRowId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    document
      .querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")
      .forEach((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const distance =
          clientY < rect.top
            ? rect.top - clientY
            : clientY > rect.bottom
              ? clientY - rect.bottom
              : 0;

        if (distance < closestDistance) {
          closestDistance = distance;
          closestRowId = candidate.dataset.rowId ?? null;
        }
      });

    return closestRowId;
  }

  function autoScrollDuringRowDrag(clientY: number) {
    const threshold = 72;
    const speed = 18;

    if (clientY < threshold) {
      window.scrollBy(0, -speed);
    } else if (clientY > window.innerHeight - threshold) {
      window.scrollBy(0, speed);
    }

    const wrapper = tableWrapRef.current;
    if (!wrapper || wrapper.scrollHeight <= wrapper.clientHeight) return;

    const rect = wrapper.getBoundingClientRect();
    if (clientY < rect.top + threshold) {
      wrapper.scrollTop -= speed;
    } else if (clientY > rect.bottom - threshold) {
      wrapper.scrollTop += speed;
    }
  }

  function copyContainerNumber(containerNumber: string, rowId: string) {
    navigator.clipboard?.writeText(containerNumber).catch(() => undefined);
    setCopiedContainer(rowId);
    window.setTimeout(() => {
      setCopiedContainer((current) => (current === rowId ? null : current));
    }, 1200);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = loginCode.trim();
    const normalizedPassword = loginPassword.trim();

    if (!normalizedCode || !normalizedPassword) {
      setLoginState("error");
      setError("请输入客户代码和密码。");
      return;
    }

    setLoginState("loading");
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalizedCode,
          password: normalizedPassword,
        }),
      });
      const payload = (await response.json()) as {
        customer?: CustomerOption;
        error?: string;
      };

      if (!response.ok || !payload.customer) {
        throw new Error(payload.error ?? "登录失败");
      }

      setCustomer(payload.customer);
      setCustomerSwitchCode(payload.customer.code ?? "");
      setLoginCode("");
      setLoginPassword("");
      setPage(1);
      setLoginState("idle");
    } catch (loginError) {
      setLoginState("error");
      setLoginPassword("");
      setError(
        loginError instanceof Error ? loginError.message : "登录失败",
      );
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCustomer(null);
    setCustomerOptions([]);
    setCustomerSwitchCode("");
    setCustomerSwitchState("idle");
    setCustomerSwitchMessage("");
    setContainers([]);
    setExpandedContainers(new Set());
    setExpandedWarehouseDetails(new Set());
    setTotalCount(0);
    setAllContainers(0);
    setPendingPickup(0);
    setPickedUp(0);
    setSearchInput("");
    setSearch("");
    setCustomerSettings(defaultCustomerVisibilitySettings);
    setSettingsState("idle");
    setSettingsMessage("");
    setPickupStatus("all");
    setSelectedOperationMode("");
    setDateField("orderDate");
    setDateFrom("");
    setDateTo("");
    setEditingDateCell(null);
    setDateDraft("");
    setDateCellErrors({});
    clearAllDateSaving();
    setEditingAppointmentCell(null);
    setAppointmentDraft("");
    setAppointmentCellErrors({});
    clearAllAppointmentSaving();
    setAppointmentDocumentErrors({});
    setSavingAppointmentDocuments(new Set());
    savingAppointmentDocumentKeysRef.current.clear();
    setContainerBillErrors({});
    setSavingContainerBills(new Set());
    savingContainerBillKeysRef.current.clear();
    setEditingWarehouseDetailCell(null);
    setWarehouseDetailDraft("");
    setWarehouseDetailCellErrors({});
    clearAllWarehouseDetailSaving();
    setPage(1);
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordState("loading");
    setPasswordMessage("");

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "修改密码失败");
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordState("idle");
      setPasswordMessage("密码已更新");
      setShowPasswordForm(false);
    } catch (passwordError) {
      setPasswordState("error");
      setPasswordMessage(
        passwordError instanceof Error ? passwordError.message : "修改密码失败",
      );
    }
  }

  if (!authChecked) {
    return (
      <main className="authShell">
        <section className="loginPanel loadingLoginPanel">
          <div className="loginBrand">
            <Image
              className="loginLogo"
              src="/logo.svg"
              alt="G&G Transport Inc"
              width={248}
              height={50}
              priority
            />
            <div className="loginBrandCopy">
              <p className="loginBrandName">G&G Transport</p>
              <h1>Customer Portal</h1>
              <p>正在检查登录状态</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="authShell">
        <section className="loginPanel" aria-labelledby="login-title">
          <div className="loginBrand">
            <Image
              className="loginLogo"
              src="/logo.svg"
              alt="G&G Transport Inc"
              width={248}
              height={50}
              priority
            />
            <div className="loginBrandCopy">
              <p className="loginBrandName">G&G Transport</p>
              <h1 id="login-title">Customer Portal</h1>
              <p>登录后查看订单、柜号及派送状态</p>
            </div>
          </div>
          <form className="loginForm" onSubmit={handleLogin} noValidate>
            <div className="loginField">
              <label htmlFor="login-code">客户代码</label>
              <div className="loginInputShell">
                <UserRound
                  className="loginInputIcon"
                  size={16}
                  aria-hidden="true"
                />
                <input
                  id="login-code"
                  value={loginCode}
                  onChange={(event) => setLoginCode(event.target.value)}
                  placeholder="请输入客户代码"
                  autoComplete="username"
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={loginState === "error" && !loginCode.trim()}
                  autoFocus
                />
              </div>
            </div>
            <div className="loginField">
              <label htmlFor="login-password">密码</label>
              <div className="loginInputShell passwordInputShell">
                <input
                  id="login-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="请输入密码"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={loginState === "error" && !loginPassword.trim()}
                />
                <button
                  type="button"
                  className="passwordToggle"
                  aria-label={showLoginPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowLoginPassword((value) => !value)}
                >
                  {showLoginPassword ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <div id="login-error" className="loginError" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
            <button
              className="primaryButton loginSubmitButton"
              type="submit"
              disabled={loginState === "loading"}
            >
              {loginState === "loading" ? (
                <>
                  <LoaderCircle
                    className="buttonSpinner"
                    size={16}
                    aria-hidden="true"
                  />
                  正在登录...
                </>
              ) : (
                "登录"
              )}
            </button>
            <p className="loginHelp">无法登录？请联系 G&G Transport 客服</p>
          </form>
        </section>
        <p className="authCopyright">© 2026 G&G Transport Inc.</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="pageHeader">
        <div className="pageTitleGroup">
          <Image
            className="headerLogo"
            src="/logo.svg"
            alt="G&G Transport Inc"
            width={248}
            height={50}
            priority
          />
          <div className="titleCopy">
            <p className="portalEyebrow">Customer Portal</p>
            <div className="titleLine">
              <h1>{customer.name}</h1>
              <span className={`roleBadge ${isAdmin ? "admin" : "customer"}`}>
                {isAdmin ? "客服编辑" : "客户只读"}
              </span>
            </div>
            <p className="pageSubtitle">订单管理与派送状态</p>
          </div>
        </div>
        <div className="topActions">
          {isAdmin ? (
            <div
              className="customerSwitcher"
              title={
                customerSwitchMessage ||
                "切换后将以客服编辑身份查看所选客户"
              }
            >
              <UsersRound size={16} aria-hidden="true" />
              <select
                value={customerSwitchCode}
                onChange={(event) => setCustomerSwitchCode(event.target.value)}
                aria-label="切换客户账户"
                disabled={customerSwitchState === "loading"}
              >
                {customerOptions.length === 0 ? (
                  <option value={customer.code ?? ""}>
                    {customer.name}
                  </option>
                ) : (
                  customerOptions.map((option) => (
                    <option key={option.id} value={option.code ?? ""}>
                      {option.code ? `${option.name} · ${option.code}` : option.name}
                    </option>
                  ))
                )}
              </select>
              <button
                className="switchCustomerButton"
                type="button"
                onClick={handleSwitchCustomer}
                disabled={
                  customerSwitchState === "loading" ||
                  !customerSwitchCode ||
                  customerSwitchCode.toLowerCase() === customer.code?.toLowerCase()
                }
              >
                {customerSwitchState === "loading" ? (
                  <LoaderCircle
                    className="buttonSpinner"
                    size={14}
                    aria-hidden="true"
                  />
                ) : null}
                切换
              </button>
            </div>
          ) : null}
          {isAdmin ? (
            <div className={syncStatusClass} title={getSyncStatusTitle(syncStatus)}>
              <span className="syncStatusDot" aria-hidden="true" />
              <div>
                <span>同步状态</span>
                <strong>
                  {syncActionState === "loading"
                    ? "同步中"
                    : syncStatusState === "loading"
                      ? "读取中"
                      : syncStatusState === "error"
                        ? "失败"
                    : getSyncStatusLabel(syncStatus)}
                </strong>
              </div>
              <small>
                {syncStatusMessage
                  ? syncStatusMessage
                  : syncStatus
                  ? `${getSyncStatusPrefix(syncStatus)} ${formatSyncTime(syncStatus.finishedAt ?? syncStatus.startedAt)}`
                    : "暂无同步记录"}
              </small>
            </div>
          ) : null}
          {isAdmin ? (
            <button
              className="iconButton"
              type="button"
              onClick={runSourceSync}
              disabled={syncActionState === "loading"}
            >
              {syncActionState === "loading" ? (
                <LoaderCircle
                  className="buttonSpinner"
                  size={16}
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              立即同步
            </button>
          ) : null}
          <button className="iconButton" type="button" onClick={refreshContainers}>
            <RefreshCw size={16} aria-hidden="true" />
            刷新
          </button>
          {!isAdmin ? (
            <button
              className="iconButton"
              type="button"
              onClick={() => setShowPasswordForm((value) => !value)}
            >
              <Settings size={16} aria-hidden="true" />
              修改密码
            </button>
          ) : null}
          <button
            className="iconButton dangerButton"
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={16} aria-hidden="true" />
            退出登录
          </button>
        </div>
      </section>

      <section className="balancePanel" aria-label="未结账款">
        <div className="balanceSummary">
          <div className="balanceMetric">
            <span className="balanceLabel">未结账款</span>
            <strong className={balanceAmountClass}>
              {balanceState === "loading" && !customerBalance
                ? "读取中..."
                : formatUsd(customerBalance?.balanceDueUsd)}
            </strong>
          </div>
          <div className="balanceMetric">
            <span className="balanceLabel">剩余板数</span>
            <strong className="inventoryAmount">
              {balanceState === "loading" && !customerBalance
                ? "读取中..."
                : `${formatInteger(customerBalance?.inventoryRemainingPallets)} 板`}
            </strong>
          </div>
        </div>
        {isAdmin ? (
          <form className="balanceForm" onSubmit={handleSaveBalance}>
            <label className="balanceInput">
              <span aria-hidden="true">$</span>
              <input
                value={balanceDraft}
                onChange={(event) => setBalanceDraft(event.target.value)}
                inputMode="decimal"
                aria-label="未结账款金额"
                placeholder="0.00"
              />
            </label>
            <button
              className="balanceSaveButton"
              type="submit"
              disabled={balanceState === "loading"}
            >
              {balanceState === "loading" ? "保存中" : "保存"}
            </button>
          </form>
        ) : null}
        {balanceMessage ? (
          <p
            className={`balanceMessage ${
              balanceState === "error" ? "isError" : ""
            }`}
            role={balanceState === "error" ? "alert" : "status"}
          >
            {balanceMessage}
          </p>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="settingsPanel" aria-label="客户只读字段权限">
          <div className="settingsSummary">
            <span className="settingsLabel">客户只读字段权限</span>
            <strong>控制客户账号可查看的预约字段</strong>
          </div>
          <div className="settingsToggleGroup">
            {customerVisibilityOptions.map((option) => (
              <label className="settingsToggle" key={option.key}>
                <input
                  type="checkbox"
                  checked={customerSettings[option.key]}
                  disabled={settingsState === "loading"}
                  onChange={(event) =>
                    updateCustomerSetting(option.key, event.currentTarget.checked)
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {settingsMessage ? (
            <p
              className={`settingsMessage ${
                settingsState === "error" ? "isError" : ""
              }`}
              role={settingsState === "error" ? "alert" : "status"}
            >
              {settingsMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {!isAdmin && (showPasswordForm || passwordMessage) ? (
        <section className="passwordPanel">
          <form className="passwordForm" onSubmit={handleChangePassword}>
            <label className="field">
              <span>当前密码</span>
              <input
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
              />
            </label>
            <label className="field">
              <span>新密码</span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                minLength={6}
              />
            </label>
            <button
              className="primaryButton"
              type="submit"
              disabled={passwordState === "loading"}
            >
              {passwordState === "loading" ? "保存中" : "保存密码"}
            </button>
            {passwordMessage ? (
              <div
                className={
                  passwordState === "error" ? "error compact" : "successMessage"
                }
              >
                {passwordMessage}
              </div>
            ) : null}
          </form>
        </section>
      ) : null}

      <section className="controls" aria-label="筛选条件">
        <label className="field searchField">
          <Search className="fieldIcon" size={16} aria-hidden="true" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索柜号、仓点或订单号"
          />
        </label>

        <label className="field compactField">
          <select
            value={selectedOperationMode}
            onChange={(event) => setSelectedOperationMode(event.target.value)}
            aria-label="操作方式"
          >
            <option value="">全部方式</option>
            <option value="unload">拆柜</option>
            <option value="direct_delivery">直送</option>
          </select>
        </label>

        <label className="field compactField">
          <select
            value={dateField}
            onChange={(event) =>
              setDateField(event.target.value as DateFilterField)
            }
            aria-label="日期字段"
          >
            <option value="orderDate">订单日期</option>
            <option value="etaDate">ETA</option>
            <option value="lfdDate">LFD</option>
            <option value="pickupDate">提柜日期</option>
          </select>
        </label>

        <div className="dateRangeGroup" aria-label="日期范围">
          <label className="field dateField">
            <CalendarDays className="fieldIcon" size={16} aria-hidden="true" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="开始日期"
            />
          </label>
          <span className="dateSeparator">-</span>
          <label className="field dateField">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="结束日期"
            />
          </label>
        </div>

        <button
          className="resetButton"
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          <RotateCcw size={15} aria-hidden="true" />
          重置
        </button>
      </section>

      <section className="statusTabs" aria-label="提柜状态">
        <StatusTab
          active={pickupStatus === "all"}
          count={allContainers}
          label="全部"
          onClick={() => setPickupStatus("all")}
        />
        <StatusTab
          active={pickupStatus === "pending"}
          count={pendingPickup}
          label="未提柜"
          onClick={() => setPickupStatus("pending")}
        />
        <StatusTab
          active={pickupStatus === "picked"}
          count={pickedUp}
          label="已提柜"
          onClick={() => setPickupStatus("picked")}
        />
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="tableArea">
        <div className="tableHeader">
          <h2>柜号列表</h2>
          <span>{loadState === "loading" ? "加载中" : `唯一柜号 ${pageStats.uniqueContainers}`}</span>
        </div>

        <div className="tableWrap" ref={tableWrapRef}>
          <table
            className="containerTable"
            style={{ minWidth: table.getCenterTotalSize() }}
          >
            <colgroup>
              {table.getVisibleLeafColumns().map((column) => (
                <col
                  key={column.id}
                  style={{
                    width: column.getSize(),
                    minWidth: column.columnDef.minSize,
                    maxWidth: column.columnDef.maxSize,
                  }}
                />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      aria-sort={
                        header.column.getCanSort()
                          ? getAriaSort(header.column.getIsSorted())
                          : undefined
                      }
                    >
                      <div className="headerCell">
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className="sortButton"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!header.column.getCanSort()}
                            title={
                              header.column.getCanSort()
                                ? getSortTitle(header.column.getIsSorted())
                                : undefined
                            }
                          >
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </span>
                            {header.column.getCanSort() ? (
                              <span className="sortIndicator">
                                <SortIcon
                                  sortDirection={header.column.getIsSorted()}
                                />
                              </span>
                            ) : null}
                          </button>
                        )}
                        {header.column.getCanResize() ? (
                          <button
                            type="button"
                            className={`resizeHandle ${
                              header.column.getIsResizing() ? "isResizing" : ""
                            }`}
                            aria-label={`调整 ${String(
                              header.column.columnDef.header,
                            )} 列宽`}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                          />
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const container = row.original;
                const isExpanded = expandedContainers.has(container.rowId);

                return (
                  <Fragment key={row.id}>
                    <tr
                      data-row-id={row.id}
                      className={[
                        draggedRowId === row.id ? "isDragging" : "",
                        dragOverRowId === row.id ? "isDragTarget" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const content = flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        );

                        if (cell.column.id === "containerNumber") {
                          return (
                            <th
                              key={cell.id}
                              scope="row"
                              className="strong"
                              style={{ width: cell.column.getSize() }}
                            >
                              {content}
                            </th>
                          );
                        }

                        return (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded ? (
                      <tr className="detailsRow">
                        <td colSpan={visibleColumnCount}>
                          <div className="detailsPanel warehouseDetailsPanel">
                            <div className="warehouseDetailsContent">
                              <div className="detailsHeaderRow">
                                <div>
                                  <div className="detailsTitle">仓点明细</div>
                                  <div className="detailsSubtitle">
                                    送仓地点、实际板数与预约状态
                                  </div>
                                </div>
                                <span>
                                  {container.warehouseDetails.length
                                    ? `${container.warehouseDetails.length} 个仓点`
                                    : "暂无仓点"}
                                </span>
                              </div>
                              {container.warehouseDetails.length ? (
                                <div className="warehouseDetailList">
                                  <div className="warehouseDetailListHeader">
                                    <span>送仓地点</span>
                                    <span>窗口期</span>
                                    <span>备注</span>
                                    <span>实际板数</span>
                                    <span>预约数</span>
                                  </div>
                                  {container.warehouseDetails.map((detail) => {
                                    const detailKey = getWarehouseDetailKey(
                                      container.rowId,
                                      detail.sourceOrderDetailId,
                                    );
                                    const isDetailExpanded =
                                      expandedWarehouseDetails.has(detailKey);

                                    return (
                                      <section
                                        className={[
                                          "warehouseDetailItem",
                                          isDetailExpanded ? "expanded" : "",
                                        ]
                                          .filter(Boolean)
                                          .join(" ")}
                                        key={detailKey}
                                      >
                                        <div className="warehouseDetailSummary">
                                          <button
                                            type="button"
                                            className="tableIconButton expandIconButton"
                                            aria-expanded={isDetailExpanded}
                                            aria-label={
                                              isDetailExpanded
                                                ? "收起送仓预约"
                                                : "展开送仓预约"
                                            }
                                            onClick={() =>
                                              toggleWarehouseDetail(
                                                container.rowId,
                                                detail.sourceOrderDetailId,
                                              )
                                            }
                                          >
                                            <ChevronRight
                                              className={
                                                isDetailExpanded
                                                  ? "chevronIcon expanded"
                                                  : "chevronIcon"
                                              }
                                              size={15}
                                              aria-hidden="true"
                                            />
                                          </button>
                                          <div className="warehousePointCell">
                                            <TruncatedText
                                              text={detail.warehousePoint}
                                              className="warehousePointText"
                                            />
                                          </div>
                                          <div className="warehouseWindowCell">
                                            <TruncatedText
                                              text={valueOrDash(
                                                detail.windowPeriod,
                                              )}
                                              className={
                                                detail.windowPeriod
                                                  ? "warehouseWindowText"
                                                  : "warehouseWindowText emptyText"
                                              }
                                            />
                                          </div>
                                          <div className="warehouseNoteCell">
                                            <InlineEditableTextCell
                                              error={
                                                textCellErrors[
                                                  getWarehouseDetailTextKey(
                                                    container.rowId,
                                                    detail.sourceOrderDetailId,
                                                    "customerNote",
                                                  )
                                                ]
                                              }
                                              isSaving={savingTextCells.has(
                                                getWarehouseDetailTextKey(
                                                  container.rowId,
                                                  detail.sourceOrderDetailId,
                                                  "customerNote",
                                                ),
                                              )}
                                              label={`${detail.warehousePoint} 仓点备注`}
                                              onCommit={(value) =>
                                                commitWarehouseCustomerNote(
                                                  container,
                                                  detail,
                                                  value,
                                                )
                                              }
                                              placeholder="添加备注"
                                              readOnly={!isAdmin}
                                              value={detail.customerNote}
                                            />
                                          </div>
                                          <div className="warehousePalletCell">
                                            <EditableWarehouseDetailCell
                                              detail={detail}
                                              container={container}
                                              draft={warehouseDetailDraft}
                                              error={
                                                warehouseDetailCellErrors[
                                                  getWarehouseDetailCellKey(
                                                    container.rowId,
                                                    detail.sourceOrderDetailId,
                                                    "actualPallets",
                                                  )
                                                ]
                                              }
                                              field="actualPallets"
                                              isEditing={isEditingWarehouseDetailCell(
                                                editingWarehouseDetailCell,
                                                container.rowId,
                                                detail.sourceOrderDetailId,
                                                "actualPallets",
                                              )}
                                              isSaving={savingWarehouseDetailCells.has(
                                                getWarehouseDetailCellKey(
                                                  container.rowId,
                                                  detail.sourceOrderDetailId,
                                                  "actualPallets",
                                                ),
                                              )}
                                              onCancel={cancelWarehouseDetailEdit}
                                              onCommit={(value) =>
                                                commitWarehouseDetailEdit(
                                                  container,
                                                  detail,
                                                  "actualPallets",
                                                  value,
                                                )
                                              }
                                              onDraftChange={
                                                setWarehouseDetailDraft
                                              }
                                              readOnly={!isAdmin}
                                              onStart={() =>
                                                startWarehouseDetailEdit(
                                                  container,
                                                  detail,
                                                  "actualPallets",
                                                )
                                              }
                                            />
                                          </div>
                                          <span className="appointmentCountBadge">
                                            {detail.appointments.length} 个
                                          </span>
                                        </div>
                                        {isDetailExpanded ? (
                                          <div className="warehouseAppointmentPanel">
                                            <div className="appointmentTitle">
                                              送仓预约
                                            </div>
                                            {detail.appointments.length &&
                                            visibleAppointmentColumnCount > 0 ? (
                                              <div
                                                className={[
                                                  "warehouseAppointmentGrid",
                                                  isAdmin ? "isAdmin" : "",
                                                ]
                                                  .filter(Boolean)
                                                  .join(" ")}
                                                style={appointmentGridStyle}
                                              >
                                                <div
                                                  className="warehouseAppointmentHeader"
                                                  style={appointmentGridStyle}
                                                >
                                                  {isAdmin ? (
                                                    <span>客户可见</span>
                                                  ) : null}
                                                  {appointmentColumnSettings.showAppointmentNumber ? (
                                                    <span>预约号码</span>
                                                  ) : null}
                                                  {appointmentColumnSettings.showDeliveryDate ? (
                                                    <span>送仓日</span>
                                                  ) : null}
                                                  {appointmentColumnSettings.showEffectivePallets ? (
                                                    <span>有效板数</span>
                                                  ) : null}
                                                  {appointmentColumnSettings.showPod ? (
                                                    <span>POD</span>
                                                  ) : null}
                                                  {appointmentColumnSettings.showBol ? (
                                                    <span>BOL</span>
                                                  ) : null}
                                                </div>
                                                {detail.appointments.map(
                                                  (
                                                    appointment,
                                                    appointmentIndex,
                                                  ) => {
                                                    const sourceOrderDetailId =
                                                      getAppointmentSourceDetailId(
                                                        appointment,
                                                        detail,
                                                      );
                                                    const visibilityKey =
                                                      getAppointmentVisibilityKey(
                                                        container.rowId,
                                                        sourceOrderDetailId,
                                                      );
                                                    const canSelectVisibility =
                                                      canSelectAppointmentVisibility(
                                                        appointment,
                                                      );
                                                    const isSavingVisibility =
                                                      savingAppointmentVisibility.has(
                                                        visibilityKey,
                                                      );
                                                    const visibilityError =
                                                      appointmentVisibilityErrors[
                                                        visibilityKey
                                                      ];

                                                    return (
                                                    <div
                                                      className="warehouseAppointmentItem"
                                                      key={`${appointment.sourceAppointmentLineId}-${appointmentIndex}`}
                                                      style={appointmentGridStyle}
                                                    >
                                                      {isAdmin ? (
                                                        <div className="appointmentVisibilityCell">
                                                          <button
                                                            type="button"
                                                            className={[
                                                              "visibleAppointmentButton",
                                                              appointment.isCustomerVisible
                                                                ? "selected"
                                                                : "",
                                                            ]
                                                              .filter(Boolean)
                                                              .join(" ")}
                                                            disabled={
                                                              !canSelectVisibility ||
                                                              isSavingVisibility
                                                            }
                                                            title={
                                                              canSelectVisibility
                                                                ? appointment.isCustomerVisible
                                                                  ? "客户只读页面正在显示这条预约"
                                                                  : "设置为客户只读页面显示的预约"
                                                                : "旧预约数据暂不支持指定客户可见"
                                                            }
                                                            onClick={() =>
                                                              commitAppointmentVisibility(
                                                                container,
                                                                detail,
                                                                appointment,
                                                              )
                                                            }
                                                          >
                                                            {isSavingVisibility ? (
                                                              <LoaderCircle
                                                                size={13}
                                                                aria-hidden="true"
                                                              />
                                                            ) : (
                                                              <Eye
                                                                size={13}
                                                                aria-hidden="true"
                                                              />
                                                            )}
                                                            <span>
                                                              {appointment.isCustomerVisible
                                                                ? "客户可见"
                                                                : "设为可见"}
                                                            </span>
                                                          </button>
                                                          {visibilityError ? (
                                                            <span
                                                              className="appointmentVisibilityError"
                                                              role="alert"
                                                            >
                                                              {visibilityError}
                                                            </span>
                                                          ) : null}
                                                        </div>
                                                      ) : null}
                                                      {appointmentColumnSettings.showAppointmentNumber ? (
                                                      <div>
                                                        <EditableAppointmentCell
                                                          appointment={
                                                            appointment
                                                          }
                                                          container={container}
                                                          draft={
                                                            appointmentDraft
                                                          }
                                                          error={
                                                            appointmentCellErrors[
                                                              getAppointmentCellKey(
                                                                container.rowId,
                                                                getAppointmentSourceDetailId(
                                                                  appointment,
                                                                  detail,
                                                                ),
                                                                appointment.sourceAppointmentLineId,
                                                                "appointmentNumber",
                                                              )
                                                            ]
                                                          }
                                                          field="appointmentNumber"
                                                          isEditing={isEditingAppointmentCell(
                                                            editingAppointmentCell,
                                                            container.rowId,
                                                            getAppointmentSourceDetailId(
                                                              appointment,
                                                              detail,
                                                            ),
                                                            appointment.sourceAppointmentLineId,
                                                            "appointmentNumber",
                                                          )}
                                                          isSaving={savingAppointmentCells.has(
                                                            getAppointmentCellKey(
                                                              container.rowId,
                                                              getAppointmentSourceDetailId(
                                                                appointment,
                                                                detail,
                                                              ),
                                                              appointment.sourceAppointmentLineId,
                                                              "appointmentNumber",
                                                            ),
                                                          )}
                                                          onCancel={
                                                            cancelAppointmentEdit
                                                          }
                                                          onCommit={(value) =>
                                                            commitAppointmentEdit(
                                                              container,
                                                              detail,
                                                              appointment,
                                                              "appointmentNumber",
                                                              value,
                                                            )
                                                          }
                                                          onDraftChange={
                                                            setAppointmentDraft
                                                          }
                                                          readOnly={!isAdmin}
                                                          onStart={() =>
                                                            startAppointmentEdit(
                                                              container,
                                                              detail,
                                                              appointment,
                                                              "appointmentNumber",
                                                            )
                                                          }
                                                        />
                                                      </div>
                                                      ) : null}
                                                      {appointmentColumnSettings.showDeliveryDate ? (
                                                      <div>
                                                        <EditableAppointmentCell
                                                          appointment={
                                                            appointment
                                                          }
                                                          container={container}
                                                          draft={
                                                            appointmentDraft
                                                          }
                                                          error={
                                                            appointmentCellErrors[
                                                              getAppointmentCellKey(
                                                                container.rowId,
                                                                getAppointmentSourceDetailId(
                                                                  appointment,
                                                                  detail,
                                                                ),
                                                                appointment.sourceAppointmentLineId,
                                                                "deliveryDate",
                                                              )
                                                            ]
                                                          }
                                                          field="deliveryDate"
                                                          isEditing={isEditingAppointmentCell(
                                                            editingAppointmentCell,
                                                            container.rowId,
                                                            getAppointmentSourceDetailId(
                                                              appointment,
                                                              detail,
                                                            ),
                                                            appointment.sourceAppointmentLineId,
                                                            "deliveryDate",
                                                          )}
                                                          isSaving={savingAppointmentCells.has(
                                                            getAppointmentCellKey(
                                                              container.rowId,
                                                              getAppointmentSourceDetailId(
                                                                appointment,
                                                                detail,
                                                              ),
                                                              appointment.sourceAppointmentLineId,
                                                              "deliveryDate",
                                                            ),
                                                          )}
                                                          onCancel={
                                                            cancelAppointmentEdit
                                                          }
                                                          onCommit={(value) =>
                                                            commitAppointmentEdit(
                                                              container,
                                                              detail,
                                                              appointment,
                                                              "deliveryDate",
                                                              value,
                                                            )
                                                          }
                                                          onDraftChange={
                                                            setAppointmentDraft
                                                          }
                                                          readOnly={!isAdmin}
                                                          onStart={() =>
                                                            startAppointmentEdit(
                                                              container,
                                                              detail,
                                                              appointment,
                                                              "deliveryDate",
                                                            )
                                                          }
                                                        />
                                                      </div>
                                                      ) : null}
                                                      {appointmentColumnSettings.showEffectivePallets ? (
                                                      <div>
                                                        <EditableAppointmentCell
                                                          appointment={
                                                            appointment
                                                          }
                                                          container={container}
                                                          draft={
                                                            appointmentDraft
                                                          }
                                                          error={
                                                            appointmentCellErrors[
                                                              getAppointmentCellKey(
                                                                container.rowId,
                                                                getAppointmentSourceDetailId(
                                                                  appointment,
                                                                  detail,
                                                                ),
                                                                appointment.sourceAppointmentLineId,
                                                                "effectivePallets",
                                                              )
                                                            ]
                                                          }
                                                          field="effectivePallets"
                                                          isEditing={isEditingAppointmentCell(
                                                            editingAppointmentCell,
                                                            container.rowId,
                                                            getAppointmentSourceDetailId(
                                                              appointment,
                                                              detail,
                                                            ),
                                                            appointment.sourceAppointmentLineId,
                                                            "effectivePallets",
                                                          )}
                                                          isSaving={savingAppointmentCells.has(
                                                            getAppointmentCellKey(
                                                              container.rowId,
                                                              getAppointmentSourceDetailId(
                                                                appointment,
                                                                detail,
                                                              ),
                                                              appointment.sourceAppointmentLineId,
                                                              "effectivePallets",
                                                            ),
                                                          )}
                                                          onCancel={
                                                            cancelAppointmentEdit
                                                          }
                                                          onCommit={(value) =>
                                                            commitAppointmentEdit(
                                                              container,
                                                              detail,
                                                              appointment,
                                                              "effectivePallets",
                                                              value,
                                                            )
                                                          }
                                                          onDraftChange={
                                                            setAppointmentDraft
                                                          }
                                                          readOnly={!isAdmin}
                                                          onStart={() =>
                                                            startAppointmentEdit(
                                                              container,
                                                              detail,
                                                              appointment,
                                                              "effectivePallets",
                                                            )
                                                          }
                                                        />
                                                      </div>
                                                      ) : null}
                                                      {appointmentColumnSettings.showPod ? (
                                                      <div>
                                                        <AppointmentDocumentCell
                                                          appointment={
                                                            appointment
                                                          }
                                                          container={container}
                                                          documentType="pod"
                                                          document={
                                                            appointment.podDocument
                                                          }
                                                          error={
                                                            appointmentDocumentErrors[
                                                              getAppointmentDocumentKey(
                                                                container.rowId,
                                                                getAppointmentSourceDetailId(
                                                                  appointment,
                                                                  detail,
                                                                ),
                                                                appointment.sourceAppointmentLineId,
                                                                "pod",
                                                              )
                                                            ]
                                                          }
                                                          isAdmin={isAdmin}
                                                          isUploading={savingAppointmentDocuments.has(
                                                            getAppointmentDocumentKey(
                                                              container.rowId,
                                                              getAppointmentSourceDetailId(
                                                                appointment,
                                                                detail,
                                                              ),
                                                              appointment.sourceAppointmentLineId,
                                                              "pod",
                                                            ),
                                                          )}
                                                          sourceOrderDetailId={getAppointmentSourceDetailId(
                                                            appointment,
                                                            detail,
                                                          )}
                                                          onUpload={(file) =>
                                                            uploadAppointmentDocument(
                                                              {
                                                                container,
                                                                warehouseDetail:
                                                                  detail,
                                                                appointment,
                                                                documentType:
                                                                  "pod",
                                                                file,
                                                              },
                                                            )
                                                          }
                                                        />
                                                      </div>
                                                      ) : null}
                                                      {appointmentColumnSettings.showBol ? (
                                                      <div>
                                                        <AppointmentDocumentCell
                                                          appointment={
                                                            appointment
                                                          }
                                                          container={container}
                                                          documentType="bol"
                                                          document={
                                                            appointment.bolDocument
                                                          }
                                                          error={
                                                            appointmentDocumentErrors[
                                                              getAppointmentDocumentKey(
                                                                container.rowId,
                                                                getAppointmentSourceDetailId(
                                                                  appointment,
                                                                  detail,
                                                                ),
                                                                appointment.sourceAppointmentLineId,
                                                                "bol",
                                                              )
                                                            ]
                                                          }
                                                          isAdmin={isAdmin}
                                                          isUploading={savingAppointmentDocuments.has(
                                                            getAppointmentDocumentKey(
                                                              container.rowId,
                                                              getAppointmentSourceDetailId(
                                                                appointment,
                                                                detail,
                                                              ),
                                                              appointment.sourceAppointmentLineId,
                                                              "bol",
                                                            ),
                                                          )}
                                                          sourceOrderDetailId={getAppointmentSourceDetailId(
                                                            appointment,
                                                            detail,
                                                          )}
                                                          onUpload={(file) =>
                                                            uploadAppointmentDocument(
                                                              {
                                                                container,
                                                                warehouseDetail:
                                                                  detail,
                                                                appointment,
                                                                documentType:
                                                                  "bol",
                                                                file,
                                                              },
                                                            )
                                                          }
                                                        />
                                                      </div>
                                                      ) : null}
                                                    </div>
                                                    );
                                                  },
                                                )}
                                              </div>
                                            ) : detail.appointments.length ? (
                                              <div className="noAppointments">
                                                客服暂未开放预约字段
                                              </div>
                                            ) : (
                                              <div className="noAppointments">
                                                该仓点暂无送仓预约
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                      </section>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="noAppointments">
                                  该柜号暂无仓点明细
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!containers.length && loadState !== "loading" ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="empty">
                    <div className="emptyState">
                      <strong>没有匹配数据</strong>
                      <span>调整搜索、日期或状态筛选后再试。</span>
                      {hasActiveFilters ? (
                        <button type="button" onClick={resetFilters}>
                          重置筛选
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1 || loadState === "loading"}
          >
            上一页
          </button>
          <span>
            {pageStart}-{pageEnd} / {totalCount}，每页 {PAGE_SIZE}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages || loadState === "loading"}
          >
            下一页
          </button>
        </div>
      </section>
    </main>
  );
}

function StatusTab({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`statusTab ${active ? "active" : ""}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function EditableDateCell({
  container,
  draft,
  error,
  field,
  isEditing,
  isSaving,
  onCancel,
  onCommit,
  onDraftChange,
  onStart,
}: {
  container: TableContainerRecord;
  draft: string;
  error?: string;
  field: EditableDateField;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onCommit: (value: string) => void;
  onDraftChange: (value: string) => void;
  onStart: () => void;
}) {
  const value = container[field];
  const label = getDateFieldLabel(field);

  if (isEditing) {
    return (
      <div className="editableDateCell isEditing">
        <input
          className="editableDateInput"
          type="date"
          value={draft}
          aria-label={`${container.containerNumber} ${label}`}
          aria-invalid={Boolean(error)}
          autoFocus
          onBlur={(event) => onCommit(event.currentTarget.value)}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            onDraftChange(nextValue);
            if (nextValue && isValidEditableDateInput(nextValue)) {
              window.setTimeout(() => onCommit(nextValue), 0);
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={[
        "editableDateCell",
        error ? "hasError" : "",
        isSaving ? "isSaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${container.containerNumber} ${label}，点击修改`}
      disabled={isSaving}
      title={error ?? `${label}：${valueOrDash(value)}，点击修改`}
      onClick={onStart}
    >
      {isSaving ? (
        <>
          <LoaderCircle className="cellSpinner" size={13} aria-hidden="true" />
          <span className="dateText">保存中</span>
        </>
      ) : (
        <DateValue value={value} />
      )}
    </button>
  );
}

function EditableWarehouseDetailCell({
  detail,
  container,
  draft,
  error,
  field,
  isEditing,
  isSaving,
  onCancel,
  onCommit,
  onDraftChange,
  readOnly,
  onStart,
}: {
  detail: WarehouseDetail;
  container: TableContainerRecord;
  draft: string;
  error?: string;
  field: EditableWarehouseDetailField;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onCommit: (value: string) => void;
  onDraftChange: (value: string) => void;
  readOnly?: boolean;
  onStart: () => void;
}) {
  const label = getWarehouseDetailFieldLabel(field);
  const displayValue = getWarehouseDetailDisplayValue(detail, field);

  if (readOnly) {
    return (
      <span
        className="readonlyAppointmentCell"
        title={`${label}：${displayValue}`}
      >
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="editableAppointmentCell isEditing">
        <input
          className="editableAppointmentInput"
          type="number"
          min="0"
          step="1"
          value={draft}
          aria-label={`${container.containerNumber} ${detail.warehousePoint} ${label}`}
          aria-invalid={Boolean(error)}
          autoFocus
          onBlur={(event) => onCommit(event.currentTarget.value)}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={[
        "editableAppointmentCell",
        error ? "hasError" : "",
        isSaving ? "isSaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${container.containerNumber} ${detail.warehousePoint} ${label}，点击修改`}
      disabled={isSaving}
      title={error ?? `${label}：${displayValue}，点击修改`}
      onClick={onStart}
    >
      {isSaving ? (
        <>
          <LoaderCircle className="cellSpinner" size={13} aria-hidden="true" />
          <span>保存中</span>
        </>
      ) : (
        displayValue
      )}
    </button>
  );
}

function EditableAppointmentCell({
  appointment,
  container,
  draft,
  error,
  field,
  isEditing,
  isSaving,
  onCancel,
  onCommit,
  onDraftChange,
  readOnly,
  onStart,
}: {
  appointment: WarehouseAppointment;
  container: TableContainerRecord;
  draft: string;
  error?: string;
  field: EditableWarehouseAppointmentField;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onCommit: (value: string) => void;
  onDraftChange: (value: string) => void;
  readOnly?: boolean;
  onStart: () => void;
}) {
  const label = getAppointmentFieldLabel(field);
  const displayValue = getAppointmentDisplayValue(appointment, field);

  if (readOnly) {
    return (
      <span
        className="readonlyAppointmentCell"
        title={`${label}：${displayValue}`}
      >
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="editableAppointmentCell isEditing">
        <input
          className="editableAppointmentInput"
          type={
            field === "deliveryDate"
              ? "date"
              : field === "effectivePallets"
                ? "number"
                : "text"
          }
          min={field === "effectivePallets" ? "0" : undefined}
          step={field === "effectivePallets" ? "1" : undefined}
          value={draft}
          aria-label={`${container.containerNumber} ${label}`}
          aria-invalid={Boolean(error)}
          autoFocus
          onBlur={(event) => onCommit(event.currentTarget.value)}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={[
        "editableAppointmentCell",
        error ? "hasError" : "",
        isSaving ? "isSaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${container.containerNumber} ${label}，点击修改`}
      disabled={isSaving || !appointment.sourceAppointmentLineId}
      title={error ?? `${label}：${displayValue}，点击修改`}
      onClick={onStart}
    >
      {isSaving ? (
        <>
          <LoaderCircle className="cellSpinner" size={13} aria-hidden="true" />
          <span>保存中</span>
        </>
      ) : (
        displayValue
      )}
    </button>
  );
}

function AppointmentDocumentCell({
  appointment,
  container,
  document,
  documentType,
  error,
  isAdmin,
  isUploading,
  onUpload,
  sourceOrderDetailId,
}: {
  appointment: WarehouseAppointment;
  container: TableContainerRecord;
  document: AppointmentDocumentMeta;
  documentType: AppointmentDocumentType;
  error?: string;
  isAdmin: boolean;
  isUploading: boolean;
  onUpload: (file: File) => void;
  sourceOrderDetailId: string;
}) {
  const label = documentType.toUpperCase();
  const canUpload = Boolean(
    isAdmin &&
      sourceOrderDetailId &&
      appointment.sourceAppointmentLineId &&
      !appointment.sourceAppointmentLineId.startsWith("legacy:"),
  );

  return (
    <div className="documentCell">
      {document.hasFile ? (
        <a
          className="documentViewLink"
          href={getAppointmentDocumentUrl({
            appointment,
            container,
            documentType,
            sourceOrderDetailId,
          })}
          target="_blank"
          rel="noreferrer"
          title={document.fileName ?? `查看 ${label}`}
        >
          <FileText size={14} aria-hidden="true" />
          查看
        </a>
      ) : (
        <span className="documentEmpty">未上传</span>
      )}
      {canUpload ? (
        <label
          className={[
            "documentUploadButton",
            isUploading ? "isUploading" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${document.hasFile ? "更换" : "上传"} ${label}`}
          role="button"
          tabIndex={isUploading ? -1 : 0}
          title={`${document.hasFile ? "更换" : "上传"} ${label}`}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.currentTarget.querySelector("input")?.click();
          }}
        >
          {isUploading ? (
            <LoaderCircle className="cellSpinner" size={13} aria-hidden="true" />
          ) : (
            <Upload size={13} aria-hidden="true" />
          )}
          <span>{isUploading ? "上传中" : document.hasFile ? "更换" : "上传"}</span>
          <input
            accept="image/*,application/pdf"
            disabled={isUploading}
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
      ) : null}
      {error ? <span className="documentError">{error}</span> : null}
    </div>
  );
}

function ContainerBillCell({
  container,
  document,
  error,
  isAdmin,
  isUploading,
  onUpload,
}: {
  container: TableContainerRecord;
  document: AppointmentDocumentMeta;
  error?: string;
  isAdmin: boolean;
  isUploading: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="documentCell billDocumentCell">
      {document.hasFile ? (
        <a
          className="documentViewLink"
          href={getContainerBillUrl(container)}
          target="_blank"
          rel="noreferrer"
          title={document.fileName ?? "查看账单"}
        >
          <FileText size={14} aria-hidden="true" />
          查看
        </a>
      ) : (
        <span className="documentEmpty">未上传</span>
      )}
      {isAdmin ? (
        <label
          className={[
            "documentUploadButton",
            isUploading ? "isUploading" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${document.hasFile ? "更换" : "上传"}账单`}
          role="button"
          tabIndex={isUploading ? -1 : 0}
          title={`${document.hasFile ? "更换" : "上传"}账单`}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.currentTarget.querySelector("input")?.click();
          }}
        >
          {isUploading ? (
            <LoaderCircle className="cellSpinner" size={13} aria-hidden="true" />
          ) : (
            <Upload size={13} aria-hidden="true" />
          )}
          <span>{isUploading ? "上传中" : document.hasFile ? "更换" : "上传"}</span>
          <input
            accept="image/*,application/pdf"
            disabled={isUploading}
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
      ) : null}
      {error ? <span className="documentError">{error}</span> : null}
    </div>
  );
}

function DateValue({ value }: { value: string | null | undefined }) {
  const displayValue = valueOrDash(value);

  return (
    <span className={displayValue === "—" ? "dateText emptyText" : "dateText"}>
      {displayValue}
    </span>
  );
}

function InlineEditableTextCell({
  className,
  error,
  isSaving,
  label,
  onCommit,
  placeholder,
  readOnly,
  value,
}: {
  className?: string;
  error?: string;
  isSaving: boolean;
  label: string;
  onCommit: (value: string) => void;
  placeholder: string;
  readOnly: boolean;
  value: string | null | undefined;
}) {
  const displayValue = valueOrDash(value);
  const [isEditing, setIsEditing] = useState(false);

  if (readOnly) {
    return (
      <span
        className={["inlineTextValue", className].filter(Boolean).join(" ")}
        title={displayValue === "—" ? label : `${label}：${displayValue}`}
      >
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <span
        className={[
          "inlineTextEditor",
          error ? "hasError" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          key={`${label}:${value ?? ""}`}
          autoFocus
          defaultValue={value ?? ""}
          disabled={isSaving}
          maxLength={2000}
          placeholder={placeholder}
          aria-label={label}
          onBlur={(event) => {
            setIsEditing(false);
            onCommit(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setIsEditing(false);
            }
          }}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={[
        "inlineTextButton",
        error ? "hasError" : "",
        isSaving ? "isSaving" : "",
        !value?.trim() ? "isEmpty" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isSaving}
      title={error ?? (displayValue === "—" ? label : `${label}：${displayValue}`)}
      onClick={() => setIsEditing(true)}
    >
      {isSaving ? (
        <>
          <LoaderCircle className="cellSpinner" size={13} aria-hidden="true" />
          <span>保存中</span>
        </>
      ) : error ? (
        <>
          <AlertCircle size={13} aria-hidden="true" />
          <span>保存失败</span>
        </>
      ) : (
        <span>{displayValue === "—" ? placeholder : displayValue}</span>
      )}
    </button>
  );
}

function SortIcon({
  sortDirection,
}: {
  sortDirection: false | "asc" | "desc";
}) {
  if (sortDirection === "asc") {
    return <ArrowUp size={14} aria-hidden="true" />;
  }

  if (sortDirection === "desc") {
    return <ArrowDown size={14} aria-hidden="true" />;
  }

  return <ArrowUpDown size={14} aria-hidden="true" />;
}

function LocationCell({ value }: { value: string | null | undefined }) {
  const display = formatLocationPreview(value);

  return (
    <AccessibleTooltip content={display.tooltip === "—" ? "" : display.tooltip}>
      {({ triggerProps }) => (
        <span
          className="truncatedText locationCell"
          title={display.tooltip === "—" ? undefined : display.tooltip}
          {...triggerProps}
        >
          <span className="locationPreviewText">{display.preview}</span>
          {display.extraCount ? (
            <span className="locationMoreBadge">+{display.extraCount}</span>
          ) : null}
        </span>
      )}
    </AccessibleTooltip>
  );
}

function TruncatedText({
  text,
  tooltip,
  className,
}: {
  text: string | null | undefined;
  tooltip?: string;
  className?: string;
}) {
  const value = valueOrDash(text);
  const tooltipText = tooltip ?? value;
  const showTooltip = tooltipText !== "—";

  return (
    <AccessibleTooltip content={showTooltip ? tooltipText : ""}>
      {({ triggerProps }) => (
        <span
          className={["truncatedText", className].filter(Boolean).join(" ")}
          title={showTooltip ? tooltipText : undefined}
          {...triggerProps}
        >
          {value}
        </span>
      )}
    </AccessibleTooltip>
  );
}

function AccessibleTooltip({
  content,
  children,
}: {
  content: string;
  children: (props: {
    triggerProps: {
      "aria-describedby"?: string;
      onBlur: () => void;
      onClick: (event: MouseEvent<HTMLElement>) => void;
      onFocus: (event: FocusEvent<HTMLElement>) => void;
      onMouseEnter: (event: MouseEvent<HTMLElement>) => void;
      onMouseOver: (event: MouseEvent<HTMLElement>) => void;
      onMouseLeave: () => void;
      onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
      onPointerLeave: () => void;
      tabIndex?: number;
    };
  }) => ReactNode;
}) {
  const [tooltip, setTooltip] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const tooltipId = useId();

  function openTooltip(element: HTMLElement) {
    if (!content || typeof window === "undefined") return;

    const rect = element.getBoundingClientRect();
    const maxWidth = Math.min(420, window.innerWidth - 32);
    const left = Math.max(
      16,
      Math.min(rect.left, window.innerWidth - maxWidth - 16),
    );
    const top =
      rect.bottom + 10 > window.innerHeight - 80
        ? Math.max(16, rect.top - 10)
        : rect.bottom + 8;

    setTooltip({
      id: tooltipId,
      left,
      top,
    });
  }

  function closeTooltip() {
    setTooltip(null);
  }

  const triggerProps = content
    ? {
        "aria-describedby": tooltip?.id,
        onBlur: closeTooltip,
        onClick: (event: MouseEvent<HTMLElement>) =>
          openTooltip(event.currentTarget),
        onFocus: (event: FocusEvent<HTMLElement>) =>
          openTooltip(event.currentTarget),
        onMouseEnter: (event: MouseEvent<HTMLElement>) =>
          openTooltip(event.currentTarget),
        onMouseOver: (event: MouseEvent<HTMLElement>) =>
          openTooltip(event.currentTarget),
        onMouseLeave: closeTooltip,
        onPointerEnter: (event: PointerEvent<HTMLElement>) =>
          openTooltip(event.currentTarget),
        onPointerLeave: closeTooltip,
        tabIndex: 0,
      }
    : {
        onBlur: closeTooltip,
        onClick: () => undefined,
        onFocus: () => undefined,
        onMouseEnter: () => undefined,
        onMouseOver: () => undefined,
        onMouseLeave: closeTooltip,
        onPointerEnter: () => undefined,
        onPointerLeave: closeTooltip,
      };

  return (
    <>
      {children({ triggerProps })}
      {tooltip && content
        ? createPortal(
            <div
              id={tooltip.id}
              role="tooltip"
              className="cellTooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function valueOrDash(value: string | null | undefined) {
  return value && value.trim() ? value : "—";
}

function normalizeTextDraft(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function numberOrDash(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : String(value);
}

function normalizeBalanceDraft(value: string) {
  const rawValue = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(rawValue)) return null;

  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999.99) {
    return null;
  }

  return amount.toFixed(2);
}

function formatUsd(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatInteger(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getBalanceTone(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 50000 ? "isDanger" : "isWarning";
}

function getAppointmentGridTemplate(
  isAdmin: boolean,
  settings: CustomerVisibilitySettings,
) {
  const columns = [
    isAdmin ? "minmax(118px, 0.8fr)" : null,
    settings.showAppointmentNumber ? "minmax(170px, 1.35fr)" : null,
    settings.showDeliveryDate ? "minmax(120px, 0.9fr)" : null,
    settings.showEffectivePallets ? "minmax(92px, 0.65fr)" : null,
    settings.showPod ? "minmax(130px, 0.85fr)" : null,
    settings.showBol ? "minmax(130px, 0.85fr)" : null,
  ].filter(Boolean);

  return columns.length ? columns.join(" ") : "minmax(180px, 1fr)";
}

function getAppointmentGridMinWidth(columnCount: number) {
  if (columnCount <= 1) return "220px";
  if (columnCount === 2) return "360px";
  if (columnCount === 3) return "500px";
  if (columnCount === 4) return "620px";
  if (columnCount === 5) return "720px";
  return "850px";
}

function getSyncStatusLabel(syncStatus: SyncRunStatus | null) {
  if (!syncStatus) return "暂无记录";
  if (syncStatus.status === "success") return "成功";
  if (syncStatus.status === "error") return "失败";
  if (syncStatus.status === "skipped") return "跳过";
  return syncStatus.status;
}

function getSyncStatusPrefix(syncStatus: SyncRunStatus) {
  if (syncStatus.status === "success") return "同步成功";
  if (syncStatus.status === "error") return "同步失败";
  if (syncStatus.status === "skipped") return "同步跳过";
  return "同步状态";
}

function getSyncStatusTone(
  syncStatus: SyncRunStatus | null,
  loadState: LoadState,
  actionState: LoadState,
) {
  if (actionState === "error") return "isError";
  if (actionState === "loading") return "isMuted";
  if (loadState === "error") return "isError";
  if (!syncStatus) return "isMuted";
  if (syncStatus.status === "success") return "isSuccess";
  if (syncStatus.status === "error") return "isError";
  return "isMuted";
}

function getSyncStatusTitle(syncStatus: SyncRunStatus | null) {
  if (!syncStatus) return "暂无同步记录";

  const lines = [
    `状态：${getSyncStatusLabel(syncStatus)}`,
    `开始：${formatSyncTime(syncStatus.startedAt)}`,
    `结束：${formatSyncTime(syncStatus.finishedAt)}`,
    `客户：${syncStatus.customerCount}`,
    `柜号：${syncStatus.containerCount}`,
    `预约：${syncStatus.appointmentCount}`,
  ];

  if (syncStatus.message) lines.push(`信息：${syncStatus.message}`);
  return lines.join("\n");
}

function formatSyncTime(value: string | null) {
  if (!value) return "未完成";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatPercentValue(value: string | null | undefined) {
  const displayValue = valueOrDash(value);
  if (displayValue === "—") return displayValue;
  if (displayValue.endsWith("%")) return displayValue;

  const numericValue = Number(displayValue.replace(/,/g, ""));
  if (Number.isNaN(numericValue)) return displayValue;

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(numericValue)}%`;
}

function formatLocationPreview(value: string | null | undefined) {
  const rawValue = value?.trim();
  if (!rawValue) {
    return { preview: "—", tooltip: "—", extraCount: 0 };
  }

  const locations = rawValue
    .split(/[,，;；\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (locations.length <= MAX_INLINE_LOCATIONS) {
    return {
      preview: rawValue,
      tooltip: locations.length > 1 ? locations.join("\n") : rawValue,
      extraCount: 0,
    };
  }

  return {
    preview: locations.slice(0, MAX_INLINE_LOCATIONS).join(", "),
    tooltip: locations.join("\n"),
    extraCount: locations.length - MAX_INLINE_LOCATIONS,
  };
}

function createRowId(container: ContainerRecord, index: number) {
  if (container.sourceOrderId) return container.sourceOrderId;

  return [
    container.containerNumber,
    container.customerId ?? "no-customer",
    container.orderDate ?? "no-date",
    index,
  ].join("-");
}

function toDateSortValue(value: string | null) {
  if (!value) return undefined;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

const dateSorting: SortingFn<TableContainerRecord> = (rowA, rowB, columnId) => {
  const valueA = rowA.getValue<number | undefined>(columnId);
  const valueB = rowB.getValue<number | undefined>(columnId);

  if (valueA === undefined && valueB === undefined) return 0;
  if (valueA === undefined) return 1;
  if (valueB === undefined) return -1;
  return valueA - valueB;
};

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function getAriaSort(sortDirection: false | "asc" | "desc") {
  if (sortDirection === "asc") return "ascending";
  if (sortDirection === "desc") return "descending";
  return "none";
}

function getSortTitle(sortDirection: false | "asc" | "desc") {
  if (sortDirection === "asc") return "点击降序排列";
  if (sortDirection === "desc") return "点击取消排序";
  return "点击升序排列";
}

function getDateCellKey(rowId: string, field: EditableDateField) {
  return `${rowId}:${field}`;
}

function getDateFieldLabel(field: EditableDateField) {
  if (field === "orderDate") return "订单日期";
  if (field === "etaDate") return "ETA";
  if (field === "lfdDate") return "LFD";
  return "提柜日期";
}

function getAppointmentCellKey(
  rowId: string,
  sourceOrderDetailId: string,
  sourceAppointmentLineId: string,
  field: EditableWarehouseAppointmentField,
) {
  return `${rowId}:${sourceOrderDetailId}:${sourceAppointmentLineId}:${field}`;
}

function getAppointmentDocumentKey(
  rowId: string,
  sourceOrderDetailId: string,
  sourceAppointmentLineId: string,
  documentType: AppointmentDocumentType,
) {
  return `${rowId}:${sourceOrderDetailId}:${sourceAppointmentLineId}:${documentType}`;
}

function getAppointmentVisibilityKey(rowId: string, sourceOrderDetailId: string) {
  return `${rowId}:${sourceOrderDetailId}:customer-visible`;
}

function getContainerTextKey(rowId: string, field: EditableContainerTextField) {
  return `${rowId}:${field}`;
}

function getWarehouseDetailTextKey(
  rowId: string,
  sourceOrderDetailId: string,
  field: EditableWarehouseDetailTextField,
) {
  return `${rowId}:${sourceOrderDetailId}:${field}`;
}

function getContainerBillKey(rowId: string) {
  return `${rowId}:bill`;
}

function getAppointmentSourceDetailId(
  appointment: WarehouseAppointment,
  warehouseDetail: WarehouseDetail,
) {
  return appointment.sourceOrderDetailId || warehouseDetail.sourceOrderDetailId;
}

function getAppointmentDocumentUrl({
  appointment,
  container,
  documentType,
  sourceOrderDetailId,
}: {
  appointment: WarehouseAppointment;
  container: TableContainerRecord;
  documentType: AppointmentDocumentType;
  sourceOrderDetailId: string;
}) {
  const params = new URLSearchParams({
    sourceOrderId: container.sourceOrderId,
    sourceOrderDetailId,
    sourceAppointmentLineId: appointment.sourceAppointmentLineId,
    documentType,
  });

  return `/api/containers/documents?${params.toString()}`;
}

function getContainerBillUrl(container: TableContainerRecord) {
  const params = new URLSearchParams({
    sourceOrderId: container.sourceOrderId,
  });

  return `/api/containers/bills?${params.toString()}`;
}

function validateDocumentFile(file: File) {
  if (!file.size) return "文件为空";
  if (file.size > 10 * 1024 * 1024) return "文件不能超过 10MB";

  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name);

  return isPdf || isImage ? "" : "只支持图片或 PDF";
}

function guessDocumentMimeType(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "image/*";
}

function getWarehouseDetailKey(rowId: string, sourceOrderDetailId: string) {
  return `${rowId}:${sourceOrderDetailId}`;
}

function getWarehouseDetailCellKey(
  rowId: string,
  sourceOrderDetailId: string,
  field: EditableWarehouseDetailField,
) {
  return `${rowId}:${sourceOrderDetailId}:${field}`;
}

function getWarehouseDetailFieldLabel(field: EditableWarehouseDetailField) {
  if (field === "actualPallets") return "实际板数";
  return "仓点明细";
}

function isEditingWarehouseDetailCell(
  cell: {
    rowId: string;
    sourceOrderDetailId: string;
    field: EditableWarehouseDetailField;
  } | null,
  rowId: string,
  sourceOrderDetailId: string,
  field: EditableWarehouseDetailField,
) {
  return (
    cell?.rowId === rowId &&
    cell.sourceOrderDetailId === sourceOrderDetailId &&
    cell.field === field
  );
}

function getWarehouseDetailDisplayValue(
  detail: WarehouseDetail,
  field: EditableWarehouseDetailField,
) {
  if (field === "actualPallets") return numberOrDash(detail.actualPallets);
  return "—";
}

function getWarehouseDetailDraftValue(
  detail: WarehouseDetail,
  field: EditableWarehouseDetailField,
) {
  if (field === "actualPallets") {
    return detail.actualPallets === null ? "" : String(detail.actualPallets);
  }

  return "";
}

function validateWarehouseDetailDraft(
  field: EditableWarehouseDetailField,
  value: string,
) {
  if (field === "actualPallets" && value && !/^\d+$/.test(value)) {
    return "板数必须是非负整数";
  }

  return "";
}

function coerceWarehouseDetailValue(
  field: EditableWarehouseDetailField,
  value: string,
) {
  if (field === "actualPallets") return value ? Number(value) : null;
  return null;
}

function getAppointmentFieldLabel(field: EditableWarehouseAppointmentField) {
  if (field === "appointmentNumber") return "预约号码";
  if (field === "deliveryDate") return "送仓日";
  return "有效板数";
}

function isEditingAppointmentCell(
  cell: {
    rowId: string;
    sourceOrderDetailId: string;
    sourceAppointmentLineId: string;
    field: EditableWarehouseAppointmentField;
  } | null,
  rowId: string,
  sourceOrderDetailId: string,
  sourceAppointmentLineId: string,
  field: EditableWarehouseAppointmentField,
) {
  return (
    cell?.rowId === rowId &&
    cell.sourceOrderDetailId === sourceOrderDetailId &&
    cell.sourceAppointmentLineId === sourceAppointmentLineId &&
    cell.field === field
  );
}

function getAppointmentDisplayValue(
  appointment: WarehouseAppointment,
  field: EditableWarehouseAppointmentField,
) {
  if (field === "appointmentNumber") {
    return valueOrDash(appointment.appointmentNumber);
  }
  if (field === "deliveryDate") return valueOrDash(appointment.deliveryDate);
  return numberOrDash(appointment.effectivePallets);
}

function getAppointmentDraftValue(
  appointment: WarehouseAppointment,
  field: EditableWarehouseAppointmentField,
) {
  if (field === "appointmentNumber") return appointment.appointmentNumber ?? "";
  if (field === "deliveryDate") {
    return appointment.deliveryDate ?? "";
  }
  return appointment.effectivePallets === null
    ? ""
    : String(appointment.effectivePallets);
}

function validateAppointmentDraft(
  field: EditableWarehouseAppointmentField,
  value: string,
) {
  if (field === "effectivePallets" && value && !/^\d+$/.test(value)) {
    return "板数必须是非负整数";
  }

  if (
    field === "deliveryDate" &&
    value &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return "请输入有效送仓日";
  }

  return "";
}

function coerceAppointmentValue(
  field: EditableWarehouseAppointmentField,
  value: string,
) {
  if (field === "effectivePallets") return value ? Number(value) : null;
  return value || null;
}

function mapLegacyAppointmentField(
  field: EditableWarehouseAppointmentField,
): EditableAppointmentField {
  if (field === "appointmentNumber") return "isaNumber";
  if (field === "deliveryDate") return "deliveryTime";
  return "palletCount";
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
    isCustomerVisible: false,
    podDocument: emptyAppointmentDocument(),
    bolDocument: emptyAppointmentDocument(),
  };
}

function canSelectAppointmentVisibility(appointment: WarehouseAppointment) {
  return (
    Boolean(appointment.sourceOrderDetailId) &&
    Boolean(appointment.sourceAppointmentLineId) &&
    !appointment.sourceOrderDetailId.startsWith("legacy:") &&
    !appointment.sourceAppointmentLineId.startsWith("legacy:")
  );
}

function mergeAppointmentUpdate(
  current: WarehouseAppointment,
  updated: WarehouseAppointment,
): WarehouseAppointment {
  return {
    ...current,
    ...updated,
    sourceOrderDetailId:
      updated.sourceOrderDetailId || current.sourceOrderDetailId,
    podDocument: updated.podDocument.hasFile
      ? updated.podDocument
      : current.podDocument,
    bolDocument: updated.bolDocument.hasFile
      ? updated.bolDocument
      : current.bolDocument,
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

function hasDateField(
  dates: Partial<Pick<ContainerRecord, EditableDateField>>,
  field: EditableDateField,
) {
  return Object.prototype.hasOwnProperty.call(dates, field);
}

function isValidEditableDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && formatDateInput(date) === value;
}

function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getLocationText(container: ContainerRecord) {
  const warehouseDetailText = container.warehouseDetails
    ?.map((detail) => detail.warehousePoint)
    .filter(Boolean)
    .join(", ");

  if (container.operationMode === "direct_delivery") {
    return container.destination;
  }

  if (container.operationMode === "unload") {
    return warehouseDetailText || container.warehousePoints;
  }

  return container.destination ?? warehouseDetailText ?? container.warehousePoints;
}

function getMockContainerPayload({
  operationMode,
  search,
  dateField,
  dateFrom,
  dateTo,
  pickupStatus,
  page,
  pageSize,
}: {
  operationMode: string;
  search: string;
  dateField: DateFilterField;
  dateFrom: string;
  dateTo: string;
  pickupStatus: PickupStatus;
  page: number;
  pageSize: number;
}): {
  containers: TableContainerRecord[];
  total: number;
  allContainers: number;
  pendingPickup: number;
  pickedUp: number;
} {
  const allContainers = createMockContainers();
  const normalizedSearch = search.trim().toLowerCase();
  const baseFiltered = allContainers.filter((container) => {
    const matchesOperationMode =
      !operationMode || container.operationMode === operationMode;
    const locationText = getLocationText(container)?.toLowerCase() ?? "";
    const matchesSearch =
      !normalizedSearch ||
      container.containerNumber.toLowerCase().includes(normalizedSearch) ||
      locationText.includes(normalizedSearch);
    const dateValue = container[dateField];
    const matchesDateFrom = !dateFrom || Boolean(dateValue && dateValue >= dateFrom);
    const matchesDateTo = !dateTo || Boolean(dateValue && dateValue <= dateTo);

    return matchesOperationMode && matchesSearch && matchesDateFrom && matchesDateTo;
  });
  const filtered = baseFiltered.filter((container) => {
    if (pickupStatus === "pending") return !container.pickupDate;
    if (pickupStatus === "picked") return Boolean(container.pickupDate);
    return true;
  });
  const start = (page - 1) * pageSize;

  return {
    containers: filtered.slice(start, start + pageSize),
    total: filtered.length,
    allContainers: baseFiltered.length,
    pendingPickup: baseFiltered.filter((container) => !container.pickupDate).length,
    pickedUp: baseFiltered.filter((container) => Boolean(container.pickupDate)).length,
  };
}

function createMockContainers(): TableContainerRecord[] {
  const edgeCases: Array<
    Omit<
      ContainerRecord,
      "warehouseDetails" | "billDocument" | "extraChargeResponsibility"
    > & {
      extraChargeResponsibility?: string | null;
      warehouseDetails?: WarehouseDetail[];
      billDocument?: AppointmentDocumentMeta;
    }
  > = [
    {
      sourceOrderId: "mock-edge-1",
      containerNumber: "TEST0000001",
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName: "Long Text Layout Test",
      orderDate: "2026-01-01",
      etaDate: "2026-01-08",
      lfdDate: "2026-01-12",
      pickupDate: null,
      operationMode: "direct_delivery",
      operationModeLabel: "直送",
      destination: "FAT2",
      warehousePoints: null,
      appointments: [],
      warehouseDetails: [],
    },
    {
      sourceOrderId: "mock-edge-2",
      containerNumber: "TEST0000003",
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName: "Long Text Layout Test",
      orderDate: "2026-01-02",
      etaDate: "2026-01-09",
      lfdDate: "2026-01-13",
      pickupDate: null,
      operationMode: "unload",
      operationModeLabel: "拆柜",
      destination: null,
      warehousePoints: "FAT2, HLI2, MCC1",
      appointments: [
        {
          sourceAppointmentId: "mock-appointment-1",
          warehousePoint: "FAT2",
          isaNumber: "ISA-LONG-001",
          deliveryTime: "2026-01-10 09:00",
          palletCount: 12,
        },
      ],
      warehouseDetails: [
        createMockWarehouseDetail("mock-edge-2-detail-1", "FAT2", 12, [
          {
            sourceOrderDetailId: "mock-edge-2-detail-1",
            sourceAppointmentLineId: "mock-edge-2-line-1",
            sourceAppointmentId: "mock-appointment-1",
            appointmentNumber: "ISA-LONG-001",
            deliveryDate: "2026-01-10",
            estimatedPallets: 12,
            rejectedPallets: 0,
            effectivePallets: 12,
            podDocument: emptyAppointmentDocument(),
            bolDocument: emptyAppointmentDocument(),
          },
        ]),
        createMockWarehouseDetail("mock-edge-2-detail-2", "HLI2", 8, []),
        createMockWarehouseDetail("mock-edge-2-detail-3", "MCC1", 6, []),
      ],
    },
    {
      sourceOrderId: "mock-edge-3",
      containerNumber: "TEST0000010",
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName: "Long Text Layout Test",
      orderDate: "2026-01-03",
      etaDate: "2026-01-10",
      lfdDate: "2026-01-14",
      pickupDate: null,
      operationMode: "unload",
      operationModeLabel: "拆柜",
      destination: null,
      warehousePoints:
        "FAT2, HLI2, MCC1, SCK8, BFI3, LGB8, ONT8, GYR3, LAS1, TEB9, 超长中文仓点测试, MIXED-WAREHOUSE-中文-01",
      appointments: [],
      warehouseDetails: [
        "FAT2",
        "HLI2",
        "MCC1",
        "SCK8",
        "BFI3",
        "LGB8",
        "ONT8",
        "GYR3",
        "LAS1",
        "TEB9",
        "超长中文仓点测试",
        "MIXED-WAREHOUSE-中文-01",
      ].map((warehousePoint, index) =>
        createMockWarehouseDetail(
          `mock-edge-3-detail-${index + 1}`,
          warehousePoint,
          index + 1,
          [],
        ),
      ),
    },
    {
      sourceOrderId: "mock-edge-4",
      containerNumber: "TESTLONGCODE",
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName: "Long Text Layout Test",
      orderDate: "2026-01-04",
      etaDate: "2026-01-11",
      lfdDate: "2026-01-15",
      pickupDate: null,
      operationMode: "direct_delivery",
      operationModeLabel: "直送",
      destination:
        "ULTRA-LONG-WAREHOUSE-CODE-WITHOUT-BREAKS-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
      warehousePoints: null,
      appointments: [],
      warehouseDetails: [],
    },
    {
      sourceOrderId: "mock-edge-5",
      containerNumber: "TESTEMPTY",
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName: "Long Text Layout Test",
      orderDate: "2026-01-05",
      etaDate: "2026-01-12",
      lfdDate: "2026-01-16",
      pickupDate: "2026-01-13",
      operationMode: "unload",
      operationModeLabel: "拆柜",
      destination: null,
      warehousePoints: null,
      appointments: [],
      warehouseDetails: [],
    },
    {
      sourceOrderId: "mock-edge-6",
      containerNumber: "TESTMIXEDCN",
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName: "中英文混合客户名称 Mixed Customer Name With Extra Words",
      orderDate: "2026-01-06",
      etaDate: "2026-01-13",
      lfdDate: "2026-01-17",
      pickupDate: null,
      operationMode: "unload",
      operationModeLabel: "拆柜",
      destination: null,
      warehousePoints: "洛杉矶仓点A, Oakland Warehouse B, 超长中文仓点名称测试C",
      appointments: [],
      warehouseDetails: [
        createMockWarehouseDetail("mock-edge-6-detail-1", "洛杉矶仓点A", 9, []),
        createMockWarehouseDetail(
          "mock-edge-6-detail-2",
          "Oakland Warehouse B",
          10,
          [],
        ),
        createMockWarehouseDetail(
          "mock-edge-6-detail-3",
          "超长中文仓点名称测试C",
          11,
          [],
        ),
      ],
    },
  ];

  const generatedRows = Array.from({ length: 108 }, (_, index) => {
    const rowNumber = index + 7;
    const isUnload = rowNumber % 2 === 0;

    return {
      sourceOrderId: `mock-generated-${rowNumber}`,
      containerNumber: `MOCK${String(rowNumber).padStart(7, "0")}`,
      customerId: "mock-customer",
      customerCode: "TEST",
      customerName:
        rowNumber % 9 === 0
          ? "Long Customer Name That Should Ellipsize Cleanly In The Table"
          : "Long Text Layout Test",
      orderDate: `2026-02-${String((rowNumber % 24) + 1).padStart(2, "0")}`,
      etaDate: `2026-03-${String((rowNumber % 24) + 1).padStart(2, "0")}`,
      lfdDate: `2026-03-${String((rowNumber % 24) + 3).padStart(2, "0")}`,
      pickupDate: rowNumber % 5 === 0 ? `2026-03-20` : null,
      operationMode: isUnload ? "unload" : "direct_delivery",
      operationModeLabel: isUnload ? "拆柜" : "直送",
      destination: isUnload ? null : `DST${rowNumber}, Direct Destination ${rowNumber}`,
      warehousePoints: isUnload
        ? `FAT2, HLI2, MOCK${rowNumber}, Warehouse ${rowNumber}`
        : null,
      extraChargeResponsibility:
        rowNumber % 11 === 0
          ? "产生等候费，责任归属待客服确认后同步给客户。"
          : null,
      appointments: [],
      billDocument: emptyAppointmentDocument(),
      warehouseDetails: isUnload
        ? [
            createMockWarehouseDetail(
              `mock-generated-${rowNumber}-detail-1`,
              "FAT2",
              10,
              [],
            ),
            createMockWarehouseDetail(
              `mock-generated-${rowNumber}-detail-2`,
              `MOCK${rowNumber}`,
              8,
              [
                {
                  sourceOrderDetailId: `mock-generated-${rowNumber}-detail-2`,
                  sourceAppointmentLineId: `mock-generated-${rowNumber}-line-1`,
                  sourceAppointmentId: `mock-generated-${rowNumber}-appointment-1`,
                  appointmentNumber: `ISA${rowNumber}001`,
                  deliveryDate: `2026-04-${String((rowNumber % 24) + 1).padStart(2, "0")}`,
                  estimatedPallets: 6,
                  rejectedPallets: 1,
                  effectivePallets: 5,
                  podDocument: emptyAppointmentDocument(),
                  bolDocument: emptyAppointmentDocument(),
                },
              ],
            ),
          ]
        : [],
    } satisfies ContainerRecord;
  });

  return [...edgeCases, ...generatedRows].map((container, index) => {
    const normalizedContainer: ContainerRecord = {
      ...container,
      extraChargeResponsibility: container.extraChargeResponsibility ?? null,
      billDocument: container.billDocument ?? emptyAppointmentDocument(),
      warehouseDetails: container.warehouseDetails ?? [],
    };

    return {
      ...normalizedContainer,
      rowId: createRowId(normalizedContainer, index),
    };
  });
}

function createMockWarehouseDetail(
  sourceOrderDetailId: string,
  warehousePoint: string,
  estimatedPallets: number,
  appointments: Array<
    Omit<WarehouseAppointment, "isCustomerVisible"> &
      Partial<Pick<WarehouseAppointment, "isCustomerVisible">>
  >,
): WarehouseDetail {
  return {
    sourceOrderDetailId,
    deliveryNature: "AMZ",
    warehousePoint,
    windowPeriod:
      estimatedPallets % 2 === 0 ? "Mon-Fri 08:00-16:00" : "预约后 48h 内",
    volume: (estimatedPallets * 1.33).toFixed(2),
    estimatedPallets,
    volumePercentage: "25",
    warehouseLocation: estimatedPallets % 2 === 0 ? "A0" : "C12/C15",
    actualPallets: Math.max(0, estimatedPallets - 1),
    remainingPallets: 0,
    deliveryProgress: "100",
    fba: "-",
    notes: estimatedPallets % 3 === 0 ? "到港后尽快安排派送" : "-",
    po: null,
    customerNote:
      estimatedPallets % 4 === 0
        ? "窗口期较紧，请客户提前准备收货信息。"
        : null,
    appointments: appointments.map((appointment) => ({
      ...appointment,
      isCustomerVisible: appointment.isCustomerVisible ?? false,
    })),
  };
}
