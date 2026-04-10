"use client";

import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  GripVertical,
  LoaderCircle,
  Lock,
  MapPinned,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2
} from "lucide-react";
import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DEFAULT_OLLAMA_BASE_URL, isLikelyOllamaBaseUrl } from "@/lib/llm/provider-utils";
import {
  isSupportedPlanningDestination,
  supportedDestinationGroups,
  SUPPORTED_DESTINATION_COUNT
} from "@/lib/planning/supported-destinations";
import { repairItinerary } from "@/lib/planning/validator";
import type {
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  PlanningIssue,
  TripDetail,
  TripRequest,
  TripSummary
} from "@/lib/schemas/trip";
import type { LlmSettingsResponse } from "@/lib/schemas/llm";
import { cn } from "@/lib/utils/cn";
import { getMeaningfulPoiAddress } from "@/lib/utils/poi-address";

type DashboardClientProps = {
  userEmail: string;
  initialConfig: LlmSettingsResponse;
  initialTrips: TripSummary[];
  initialSelectedTrip?: TripDetail | null;
};

type StreamEvent =
  | { type: "progress"; stage: string; message: string }
  | { type: "result"; trip: TripDetail }
  | { type: "error"; message: string };

type ApiError = {
  error?: string;
  details?: string;
};

type ModelsResponse = {
  models: string[];
  endpoint?: string;
};

type SectionHeadingProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

type StatusBadgeProps = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "pine";
};

type DestinationPickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const interestOptions = ["历史", "博物馆", "自然", "美食", "夜景", "亲子", "建筑", "拍照"];

const defaultTripRequest: TripRequest = {
  destination: "",
  startDate: new Date().toISOString().slice(0, 10),
  days: 3,
  travelers: 2,
  interests: ["历史", "美食", "夜景"],
  pace: "balanced",
  budget: "balanced",
  mustVisit: [],
  hotelArea: "",
  notes: ""
};

const panelClass =
  "rounded-[22px] border border-slate-200/90 bg-white/95 p-3.5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur md:p-4";
const fieldClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";
const textAreaClass = `${fieldClass} min-h-[84px] resize-y`;
const secondaryButtonClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";
const accentButtonClass =
  "rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric"
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPace(value: TripRequest["pace"]) {
  switch (value) {
    case "easy":
      return "轻松";
    case "packed":
      return "紧凑";
    default:
      return "平衡";
  }
}

function formatBudget(value: TripRequest["budget"]) {
  switch (value) {
    case "value":
      return "省钱优先";
    case "premium":
      return "舒适优先";
    default:
      return "预算平衡";
  }
}

function formatCandidateSourceLabel(source?: string) {
  switch (source) {
    case "amap":
      return "\u9ad8\u5fb7\u5730\u56fe";
    case "llm-web-research":
      return "\u6a21\u578b\u8054\u7f51\u8c03\u7814";
    case "wikimedia":
      return "\u8054\u7f51\u68c0\u7d22\uff08Wikimedia\uff09";
    case "core-city-seeds":
      return "\u5185\u7f6e\u57ce\u5e02\u79cd\u5b50\u70b9";
    case "hybrid-supplement":
      return "\u591a\u6e90\u5019\u9009\u70b9 + \u8865\u70b9\u517c\u5bb9";
    case "llm-fallback":
      return "\u6a21\u578b\u5019\u9009\u70b9";
    case "mock":
      return "Mock \u6570\u636e";
    default:
      return source ?? "\u672a\u77e5";
  }
}

function isTripDetail(payload: TripDetail | ApiError): payload is TripDetail {
  return !("error" in payload);
}

function getApiErrorMessage(payload: ApiError | null | undefined, fallback: string) {
  if (!payload) return fallback;
  return payload.error ?? payload.details ?? fallback;
}

async function parseNdjson(response: Response, onEvent: (event: StreamEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming is not available in this browser.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as StreamEvent);
      } catch (error) {
        throw new Error(
          `Failed to parse planning stream: ${error instanceof Error ? error.message : "Unknown parse error."}`
        );
      }
    }
  }

  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as StreamEvent);
    } catch (error) {
      throw new Error(
        `Failed to parse planning stream: ${error instanceof Error ? error.message : "Unknown parse error."}`
      );
    }
  }
}

function recomputeItinerary(itinerary: Itinerary) {
  const repaired = repairItinerary({
    ...itinerary,
    issues: []
  });

  return {
    ...repaired.itinerary,
    issues: repaired.issues
  };
}

function moveItemAcrossDays(days: ItineraryDay[], activeId: string, overId: string) {
  const sourceDayIndex = days.findIndex((day) => day.items.some((item) => item.id === activeId));
  const targetDayIndex = days.findIndex((day) => day.items.some((item) => item.id === overId));

  if (sourceDayIndex === -1 || targetDayIndex === -1) {
    return days;
  }

  if (sourceDayIndex === targetDayIndex) {
    const itemIndex = days[sourceDayIndex].items.findIndex((item) => item.id === activeId);
    const overIndex = days[targetDayIndex].items.findIndex((item) => item.id === overId);
    return days.map((day, index) =>
      index === sourceDayIndex
        ? {
            ...day,
            items: arrayMove(day.items, itemIndex, overIndex)
          }
        : day
    );
  }

  const sourceItems = [...days[sourceDayIndex].items];
  const targetItems = [...days[targetDayIndex].items];
  const movingIndex = sourceItems.findIndex((item) => item.id === activeId);
  const overIndex = targetItems.findIndex((item) => item.id === overId);
  const [moving] = sourceItems.splice(movingIndex, 1);
  targetItems.splice(overIndex, 0, moving);

  return days.map((day, index) => {
    if (index === sourceDayIndex) {
      return { ...day, items: sourceItems };
    }
    if (index === targetDayIndex) {
      return { ...day, items: targetItems };
    }
    return day;
  });
}

function getPoiMetaLine(item: ItineraryItem) {
  const address = getMeaningfulPoiAddress({
    address: item.poi.address,
    city: item.poi.city
  });

  if (address) {
    return address;
  }

  if (item.poi.openingHoursText) {
    return `营业时间参考：${item.poi.openingHoursText}`;
  }

  return null;
}

function toggleItemLock(itinerary: Itinerary, itemId: string) {
  return recomputeItinerary({
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      items: day.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              locked: !item.locked
            }
          : item
      )
    }))
  });
}

function SectionHeading({ icon, title, description, action }: SectionHeadingProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StatusBadge({ label, value, tone = "default" }: StatusBadgeProps) {
  const toneClass =
    tone === "accent"
      ? "border-accent/15 bg-accent/8 text-accent"
      : tone === "pine"
        ? "border-pine/15 bg-pine/8 text-pine"
        : "border-slate-200 bg-white text-slate-600";

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium", toneClass)}>
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DestinationPicker({ value, onChange, disabled = false }: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current || !(event.target instanceof Node) || rootRef.current.contains(event.target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedLabel = value || "请选择城市";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          fieldClass,
          "flex items-center justify-between gap-3 text-left",
          !value && "text-slate-400"
        )}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-700">按 A-Z 选择城市</p>
            <p className="mt-1 text-xs text-slate-500">{SUPPORTED_DESTINATION_COUNT} 个大城市</p>
          </div>

          <div className="max-h-72 overflow-y-auto p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {supportedDestinationGroups.map((group) => (
                <section key={group.letter} className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-2.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
                      {group.letter}
                    </span>
                    <span className="text-xs text-slate-400">{group.options.length} 城市</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {group.options.map((option) => {
                      const isSelected = option.value === value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={cn(
                            "rounded-xl px-2.5 py-1.5 text-sm transition",
                            isSelected
                              ? "bg-accent text-white shadow-[0_8px_18px_rgba(15,136,114,0.18)]"
                              : "bg-white text-slate-700 hover:border-accent/20 hover:bg-accent/5 hover:text-accent"
                          )}
                          onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                          role="option"
                          aria-selected={isSelected}
                        >
                          {option.value}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayColumn({
  day,
  onToggleLock
}: {
  day: ItineraryDay;
  onToggleLock: (itemId: string) => void;
}) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{day.date}</p>
          <h3 className="mt-1.5 text-base font-semibold text-slate-950">{day.title}</h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-xs text-slate-500">
          <p>{day.totalTravelMinutes} 分通勤</p>
          <p>强度 {day.intensityScore.toFixed(1)}</p>
        </div>
      </div>
      <SortableContext items={day.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {day.items.length > 0 ? (
          <div className="mt-3.5 space-y-3">
            {day.items.map((item) => (
              <SortableItem key={item.id} item={item} onToggleLock={onToggleLock} />
            ))}
          </div>
        ) : (
          <div className="mt-3.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            这一天还没有安排项目。
          </div>
        )}
      </SortableContext>
    </section>
  );
}

function SortableItem({
  item,
  onToggleLock
}: {
  item: ItineraryItem;
  onToggleLock: (itemId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const poiMetaLine = getPoiMetaLine(item);
  const poiImage = item.poi.image;
  const imageWidth = poiImage?.width ?? 320;
  const imageHeight = poiImage?.height ?? 240;
  const imageSourceUrl = poiImage?.sourcePageUrl ?? item.poi.sourcePageUrl;
  // Wikimedia thumbnails are already sized and can rate-limit Next's server-side optimizer.
  const shouldBypassImageOptimization = poiImage?.provider === "wikimedia";
  const previewImage = poiImage ? (
    <div className="shrink-0">
      {imageSourceUrl ? (
        <a
          href={imageSourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white"
          title="打开 Wikimedia 来源页"
        >
          <Image
            src={poiImage.url}
            alt={poiImage.alt}
            width={imageWidth}
            height={imageHeight}
            sizes="96px"
            className="h-20 w-20 object-cover transition duration-300 group-hover:scale-[1.03] sm:h-24 sm:w-24"
            draggable={false}
            unoptimized={shouldBypassImageOptimization}
          />
        </a>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Image
            src={poiImage.url}
            alt={poiImage.alt}
            width={imageWidth}
            height={imageHeight}
            sizes="96px"
            className="h-20 w-20 object-cover sm:h-24 sm:w-24"
            draggable={false}
            unoptimized={shouldBypassImageOptimization}
          />
        </div>
      )}
    </div>
  ) : null;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab rounded-[20px] border border-slate-200 bg-slate-50 px-3.5 py-3.5 transition active:cursor-grabbing",
        isDragging && "opacity-60 shadow-soft ring-2 ring-accent/20"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex gap-3">
        {previewImage}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{item.poi.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{item.category}</p>
                  {poiImage ? (
                    <span
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500"
                      title="图片来源：Wikimedia"
                    >
                      Wikimedia
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleLock(item.id);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                item.locked
                  ? "border-pine/25 bg-pine/10 text-pine"
                  : "border-slate-200 bg-white text-slate-500 hover:border-accent/30 hover:text-accent"
              )}
            >
              <Lock className="mr-1 inline h-3 w-3" />
              {item.locked ? "已锁定" : "锁定"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
            <span>
              {item.startTime} - {item.endTime}
            </span>
            <span>{item.durationMinutes} 分钟</span>
            {item.travelMinutesFromPrevious > 0 ? <span>前往 {item.travelMinutesFromPrevious} 分</span> : null}
          </div>

          {poiMetaLine ? <p className="mt-3 text-sm leading-6 text-slate-600">{poiMetaLine}</p> : null}
          {item.notes ? <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-slate-500">{item.notes}</p> : null}
        </div>
      </div>
    </article>
  );
}

export function DashboardClient({
  userEmail,
  initialConfig,
  initialTrips,
  initialSelectedTrip = null
}: DashboardClientProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [tripForm, setTripForm] = useState<TripRequest>(defaultTripRequest);
  const [config, setConfig] = useState({
    baseUrl: initialConfig.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
    apiKey: "",
    model: initialConfig.model ?? "",
    temperature: initialConfig.temperature ?? 0.3,
    enabled: initialConfig.enabled ?? true
  });
  const [hasSavedConfig, setHasSavedConfig] = useState(initialConfig.configured);
  const [lastSavedBaseUrl, setLastSavedBaseUrl] = useState(initialConfig.baseUrl ?? "");
  const [hasStoredApiKey, setHasStoredApiKey] = useState(initialConfig.hasApiKey ?? false);
  const [configStatus, setConfigStatus] = useState(
    initialConfig.configured ? "模型已配置，可以直接开始规划。" : "默认推荐本地 Ollama。填写模型名后保存即可开始规划。"
  );
  const [planningStatus, setPlanningStatus] = useState(
    initialSelectedTrip ? "已加载最新历史行程，可以继续检查、拖拽和保存。" : "先完成模型配置，然后填写需求并开始规划。"
  );
  const [configExpanded, setConfigExpanded] = useState(!initialConfig.configured);
  const [tripAdvancedExpanded, setTripAdvancedExpanded] = useState(false);
  const [tripSummaries, setTripSummaries] = useState<TripSummary[]>(initialTrips);
  const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(initialSelectedTrip);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [workspaceIssues, setWorkspaceIssues] = useState<PlanningIssue[]>(initialSelectedTrip?.itinerary.issues ?? []);
  const [availableModels, setAvailableModels] = useState<string[]>(
    initialConfig.model ? [initialConfig.model] : []
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLookupMessage, setModelLookupMessage] = useState("");

  const activeIssues = selectedTrip ? workspaceIssues : [];
  const issueSummary = {
    warnings: activeIssues.filter((issue) => issue.severity === "warning").length,
    errors: activeIssues.filter((issue) => issue.severity === "error").length
  };
  const usingLocalOllama = isLikelyOllamaBaseUrl(config.baseUrl);
  const canReuseSavedApiKey = hasStoredApiKey && lastSavedBaseUrl === config.baseUrl;
  const modelChoices = Array.from(new Set([...availableModels, ...(config.model ? [config.model] : [])]));
  const canPlan = tripForm.destination.trim().length > 0 && tripForm.interests.length > 0 && !isBusy && hasSavedConfig;
  const selectedTripSupportsReplan = !selectedTrip || isSupportedPlanningDestination(selectedTrip.request.destination);
  const planningButtonLabel = isBusy ? "规划中..." : "开始规划路线";
  const planningChecklist = [
    `目的地 ${tripForm.destination || "未填写"}`,
    `${tripForm.days} 天`,
    `${tripForm.travelers} 人`,
    tripForm.interests.length > 0 ? tripForm.interests.join(" / ") : "未选兴趣"
  ];
  const configSummary = hasSavedConfig
    ? usingLocalOllama
      ? `本地 Ollama · ${config.model || "未填写模型"}`
      : `${config.model || "未填写模型"} · ${config.baseUrl || "未填写地址"}`
    : usingLocalOllama
      ? `默认推荐本地 Ollama · ${config.baseUrl || DEFAULT_OLLAMA_BASE_URL}`
      : "尚未完成模型配置";

  useEffect(() => {
    if (!initialSelectedTrip && initialTrips[0]) {
      void loadTrip(initialTrips[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!configExpanded || !usingLocalOllama) {
      if (!usingLocalOllama) {
        setModelLookupMessage("");
      }
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadAvailableModels({ silent: true });
    }, 250);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configExpanded, config.baseUrl]);

  async function loadTrip(tripId: string) {
    setLoadingTripId(tripId);
    const response = await fetch(`/api/trips/${tripId}`, { cache: "no-store" });
    const payload = (await response.json()) as TripDetail | ApiError;
    setLoadingTripId(null);

    if (!response.ok || !isTripDetail(payload)) {
      setPlanningStatus("加载行程失败。");
      return;
    }

    setSelectedTrip(payload);
    setWorkspaceIssues(payload.itinerary.issues);
    setPlanningStatus("已加载历史行程，可以继续检查、拖拽和保存。");
  }

  async function deleteTrip(tripId: string) {
    if (!window.confirm("确认删除这条历史行程吗？删除后无法恢复。")) {
      return;
    }

    setDeletingTripId(tripId);
    const response = await fetch(`/api/trips/${tripId}`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    setDeletingTripId(null);

    if (!response.ok) {
      setPlanningStatus(getApiErrorMessage(payload, "删除历史行程失败。"));
      return;
    }

    const remaining = tripSummaries.filter((trip) => trip.id !== tripId);
    setTripSummaries(remaining);

    if (selectedTrip?.id === tripId) {
      setSelectedTrip(null);
      setWorkspaceIssues([]);

      if (remaining[0]) {
        setPlanningStatus("已删除当前行程，正在打开下一条历史记录。");
        void loadTrip(remaining[0].id);
        return;
      }
    }

    setPlanningStatus("已删除该历史行程。");
  }

  async function loadAvailableModels(options?: { silent?: boolean }) {
    if (!usingLocalOllama || !config.baseUrl.trim()) {
      setAvailableModels((current) => Array.from(new Set([...current, ...(config.model ? [config.model] : [])])));
      setModelLookupMessage("");
      return;
    }

    setIsLoadingModels(true);
    if (!options?.silent) {
      setModelLookupMessage("正在读取本地 Ollama 模型...");
    }

    const response = await fetch("/api/settings/llm/models", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey
      })
    });
    const payload = (await response.json().catch(() => null)) as ModelsResponse | ApiError | null;
    setIsLoadingModels(false);

    if (!response.ok || !payload || !("models" in payload)) {
      setModelLookupMessage(getApiErrorMessage(payload as ApiError | null, "无法读取本地模型列表。"));
      return;
    }

    setAvailableModels(payload.models);
    setModelLookupMessage(
      payload.models.length > 0
        ? `已发现 ${payload.models.length} 个本地模型，可直接点选填入。`
        : "未发现本地模型。先运行 ollama pull qwen3:8b，再回来刷新。"
    );

    if (!config.model && payload.models[0]) {
      setConfig((current) => (current.model ? current : { ...current, model: payload.models[0] }));
    }
  }

  function applyLocalPreset(mode: "fast" | "grounded") {
    setConfig((current) => ({
      ...current,
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      model: mode === "fast" ? "qwen2.5:3b" : "deepseek-r1:8b",
      temperature: 0.2,
      enabled: true
    }));
    setConfigStatus(mode === "fast" ? "已应用本地快速模式推荐配置。" : "已应用本地高质量模式推荐配置。");
  }

  async function saveConfig() {
    setIsBusy(true);
    const response = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(config)
    });
    const payload = (await response.json()) as ApiError;
    setIsBusy(false);

    if (!response.ok) {
      setConfigStatus(getApiErrorMessage(payload, "保存失败。"));
      return;
    }

    setHasSavedConfig(true);
    setLastSavedBaseUrl(config.baseUrl);
    setHasStoredApiKey(!usingLocalOllama && (hasStoredApiKey || config.apiKey.trim().length > 0));
    setConfig((current) => ({ ...current, apiKey: "" }));
    setConfigExpanded(false);
    setConfigStatus(
      usingLocalOllama
        ? "本地 Ollama 配置已保存。后续将直接使用本机模型。"
        : "模型配置已保存。API Key 已安全存储，后续留空即可沿用。"
    );
  }

  async function testConfig() {
    setIsBusy(true);
    setConfigStatus(usingLocalOllama ? "正在测试本地 Ollama 连接..." : "正在测试模型连接...");
    const response = await fetch("/api/settings/llm/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(config)
    });
    const payload = (await response.json()) as ApiError & { preview?: string; endpoint?: string };
    setIsBusy(false);
    setConfigStatus(
      response.ok
        ? `${usingLocalOllama ? "本地 Ollama 连接成功" : "连接成功"}：${payload.preview ?? "ok"}${payload.endpoint ? ` · ${payload.endpoint}` : ""}`
        : getApiErrorMessage(payload, "连接失败。")
    );
  }

  async function planTrip() {
    setIsBusy(true);
    setPlanningStatus("已提交规划请求，正在连接规划引擎...");
    let receivedTerminalEvent = false;

    try {
      const response = await fetch("/api/trips/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(tripForm)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        setPlanningStatus(getApiErrorMessage(payload, "规划失败。"));
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/x-ndjson")) {
        const preview = (await response.text().catch(() => "")).trim().slice(0, 180);
        if (response.redirected || contentType.includes("text/html")) {
          throw new Error("规划请求返回了登录页或其他网页内容，请先重新登录，然后查看浏览器 Console 和运行终端日志。");
        }

        throw new Error(preview ? `规划接口返回了意外内容：${preview}` : "规划接口返回了意外内容，请查看日志。");
      }

      await parseNdjson(response, (event) => {
        if (event.type === "progress") {
          setPlanningStatus(event.message);
          return;
        }

        receivedTerminalEvent = true;

        if (event.type === "error") {
          console.error("Trip planning stream returned an error event.", event.message);
          setPlanningStatus(event.message);
          return;
        }

        setSelectedTrip(event.trip);
        setWorkspaceIssues(event.trip.itinerary.issues);
        setTripSummaries((current) => {
          const next = [event.trip, ...current.filter((trip) => trip.id !== event.trip.id)];
          return next.map((trip) => ({
            id: trip.id,
            title: trip.title,
            destination: trip.destination,
            startDate: trip.startDate,
            days: trip.days,
            status: trip.status,
            updatedAt: trip.updatedAt
          }));
        });
        setPlanningStatus("规划完成，可以继续拖拽调整或保存。");
      });

      if (!receivedTerminalEvent) {
        throw new Error("规划请求已结束，但没有返回可用结果。请查看浏览器 Console 和运行终端日志。");
      }
    } catch (error) {
      console.error("Trip planning failed.", error);
      setPlanningStatus(error instanceof Error ? error.message : "规划失败，请查看浏览器 Console 和运行终端日志。");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveEdits() {
    if (!selectedTrip) return;

    setIsBusy(true);
    const response = await fetch(`/api/trips/${selectedTrip.id}/items`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        days: selectedTrip.itinerary.days
      })
    });

    const payload = (await response.json()) as TripDetail | ApiError;
    setIsBusy(false);

    if (!response.ok || !isTripDetail(payload)) {
      setPlanningStatus(getApiErrorMessage(isTripDetail(payload) ? null : (payload as ApiError), "保存编辑失败。"));
      return;
    }

    setSelectedTrip(payload);
    setWorkspaceIssues(payload.itinerary.issues);
    setPlanningStatus("行程编辑已保存。");
  }

  async function replanUnlocked() {
    if (!selectedTrip) return;

    setIsBusy(true);
    setPlanningStatus("正在重排未锁定项目...");
    const response = await fetch(`/api/trips/${selectedTrip.id}/replan`, {
      method: "POST"
    });
    const payload = (await response.json()) as TripDetail | ApiError;
    setIsBusy(false);

    if (!response.ok || !isTripDetail(payload)) {
      setPlanningStatus(getApiErrorMessage(isTripDetail(payload) ? null : (payload as ApiError), "重新规划失败。"));
      return;
    }

    setSelectedTrip(payload);
    setWorkspaceIssues(payload.itinerary.issues);
    setPlanningStatus("未锁定项目已重新规划。");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !selectedTrip || active.id === over.id) {
      return;
    }

    const nextDays = moveItemAcrossDays(selectedTrip.itinerary.days, String(active.id), String(over.id));
    const nextItinerary = recomputeItinerary({
      ...selectedTrip.itinerary,
      days: nextDays
    });

    startTransition(() => {
      setSelectedTrip({
        ...selectedTrip,
        itinerary: nextItinerary
      });
      setWorkspaceIssues(nextItinerary.issues);
      setPlanningStatus("已在本地重排行程，记得点击保存。");
    });
  }

  function handleToggleLock(itemId: string) {
    if (!selectedTrip) return;

    const nextItinerary = toggleItemLock(selectedTrip.itinerary, itemId);
    setSelectedTrip({
      ...selectedTrip,
      itinerary: nextItinerary
    });
    setWorkspaceIssues(nextItinerary.issues);
  }

  const selectedTripChips = selectedTrip
    ? [
        `目的地 ${selectedTrip.request.destination}`,
        `兴趣 ${selectedTrip.request.interests.join(" / ")}`,
        `来源 ${formatCandidateSourceLabel(selectedTrip.itinerary.metadata.candidateSource)}`,
        selectedTrip.request.hotelArea ? `酒店 ${selectedTrip.request.hotelArea}` : null,
        selectedTrip.request.mustVisit.length > 0 ? `必去 ${selectedTrip.request.mustVisit.join(" / ")}` : null
      ].filter((item): item is string => Boolean(item))
    : [];

  const workspaceNotes = selectedTrip
      ? [
        selectedTrip.request.notes ? `补充要求：${selectedTrip.request.notes}` : null,
        selectedTrip.itinerary.metadata.betaNotice ? `提示：${selectedTrip.itinerary.metadata.betaNotice}` : null,
        !selectedTripSupportsReplan ? "该历史行程的目的地不在当前支持城市名单内，暂不支持一键重排。" : null
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <main className="min-h-screen px-4 py-4 md:px-5 md:py-5">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <section className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.07)] backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">AI 出游路线工作台</h1>
                  <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-500">
                    {userEmail}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge label="模型" value={hasSavedConfig ? "已配置" : "待配置"} tone={hasSavedConfig ? "pine" : "accent"} />
                <StatusBadge label="行程" value={`${tripSummaries.length} 条`} />
                <StatusBadge
                  label="问题"
                  value={selectedTrip ? `${issueSummary.errors} 错误 / ${issueSummary.warnings} 提醒` : "等待生成"}
                  tone={issueSummary.errors > 0 ? "accent" : "default"}
                />
              </div>

              <p className="text-sm leading-7 text-slate-600">{planningStatus}</p>
            </div>

            <div className="rounded-[20px] border border-pine/15 bg-slate-50 p-4 xl:w-[420px]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">开始新的路线规划</h2>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {planningChecklist.map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  onClick={planTrip}
                  disabled={!canPlan}
                  className="w-full rounded-2xl bg-pine px-5 py-3 text-base font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 md:ml-auto md:w-[210px]"
                >
                  {planningButtonLabel}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[316px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className={panelClass}>
              <SectionHeading
                icon={<Settings2 className="h-5 w-5" />}
                title="模型配置"
                action={
                  <button
                    type="button"
                    onClick={() => setConfigExpanded((current) => !current)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-accent hover:text-accent"
                  >
                    {configExpanded ? "收起" : "展开"}
                    <ChevronDown className={cn("h-4 w-4 transition", configExpanded && "rotate-180")} />
                  </button>
                }
              />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {configSummary}
              </div>

              {configExpanded ? (
                <>
                  <div className="mt-4 space-y-3">
                    <label className="block space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-600">Base URL</span>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((current) => ({
                              ...current,
                              baseUrl: DEFAULT_OLLAMA_BASE_URL
                            }))
                          }
                          className="text-xs font-medium text-accent transition hover:opacity-80"
                        >
                          使用本地 Ollama
                        </button>
                      </div>
                      <input
                        className={fieldClass}
                        value={config.baseUrl}
                        onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))}
                        placeholder={DEFAULT_OLLAMA_BASE_URL}
                      />
                    </label>

                    {usingLocalOllama ? (
                      <div className="rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-sm leading-6 text-slate-600">
                        <p className="font-medium text-slate-900">已切换到本地 Ollama 模式</p>
                        <p className="mt-1">本地模式无需 API Key。请先确保已经运行 `ollama serve`，并至少拉取一个模型。</p>
                        <p className="mt-1 text-xs text-slate-500">
                          经验上 `qwen2.5:3b` 更快，`deepseek-r1:8b` 候选点通常更像真，但规划会更慢。
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applyLocalPreset("fast")}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent"
                          >
                            推荐快速模式
                          </button>
                          <button
                            type="button"
                            onClick={() => applyLocalPreset("grounded")}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent"
                          >
                            推荐高质量模式
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-600">
                        API Key {usingLocalOllama ? "（本地 Ollama 可留空）" : ""}
                      </span>
                      <input
                        className={fieldClass}
                        type="password"
                        value={config.apiKey}
                        onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))}
                        placeholder={
                          usingLocalOllama
                            ? "本地 Ollama 可留空"
                            : canReuseSavedApiKey
                              ? "留空沿用已保存 Key"
                              : "sk-..."
                        }
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-600">Model</span>
                        <input
                          className={fieldClass}
                          value={config.model}
                          onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))}
                          placeholder={usingLocalOllama ? "例如：qwen3:8b" : "gpt-4.1-mini"}
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-600">Temperature</span>
                        <input
                          className={fieldClass}
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={config.temperature}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              temperature: Number(event.target.value)
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                      <span>启用模型规划与精修</span>
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))}
                      />
                    </label>

                    {usingLocalOllama ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-900">本地模型</p>
                          <button
                            type="button"
                            onClick={() => void loadAvailableModels()}
                            disabled={isLoadingModels}
                            className="text-xs font-medium text-accent transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLoadingModels ? "读取中..." : "刷新列表"}
                          </button>
                        </div>

                        {modelChoices.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {modelChoices.map((model) => {
                              const active = config.model === model;
                              return (
                                <button
                                  key={model}
                                  type="button"
                                  onClick={() => setConfig((current) => ({ ...current, model }))}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                    active
                                      ? "border-accent bg-accent/10 text-accent"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-accent/35 hover:text-accent"
                                  )}
                                >
                                  {model}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}

                        <p className="mt-3 text-xs text-slate-500">
                          {modelLookupMessage || "如果还没模型，先运行 ollama pull qwen3:8b。"}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={testConfig} disabled={isBusy} className={secondaryButtonClass}>
                      测试连接
                    </button>
                    <button type="button" onClick={saveConfig} disabled={isBusy} className={accentButtonClass}>
                      保存配置
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    {configStatus}
                  </div>
                </>
              ) : null}
            </section>

            <section className={panelClass}>
              <SectionHeading
                icon={<MapPinned className="h-5 w-5" />}
                title="新建行程"
              />

              <div className="mt-5 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">目的地</span>
                  <DestinationPicker
                    value={tripForm.destination}
                    onChange={(value) => setTripForm((current) => ({ ...current, destination: value }))}
                    disabled={isBusy}
                  />
                </label>
                <p className="text-xs leading-5 text-slate-500">
                  {SUPPORTED_DESTINATION_COUNT} 个大城市，固定从列表选择。
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-600">出发日期</span>
                    <input
                      className={fieldClass}
                      type="date"
                      value={tripForm.startDate}
                      onChange={(event) => setTripForm((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-600">天数</span>
                    <input
                      className={fieldClass}
                      type="number"
                      min={1}
                      max={14}
                      value={tripForm.days}
                      onChange={(event) =>
                        setTripForm((current) => ({
                          ...current,
                          days: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-600">同行人数</span>
                    <input
                      className={fieldClass}
                      type="number"
                      min={1}
                      max={20}
                      value={tripForm.travelers}
                      onChange={(event) =>
                        setTripForm((current) => ({
                          ...current,
                          travelers: Number(event.target.value)
                        }))
                      }
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-600">节奏</span>
                    <select
                      className={fieldClass}
                      value={tripForm.pace}
                      onChange={(event) =>
                        setTripForm((current) => ({
                          ...current,
                          pace: event.target.value as TripRequest["pace"]
                        }))
                      }
                    >
                      <option value="easy">轻松</option>
                      <option value="balanced">平衡</option>
                      <option value="packed">紧凑</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">兴趣标签</span>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => {
                      const active = tripForm.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          className={cn(
                            "rounded-full border px-3 py-2 text-sm transition",
                            active
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-accent/35 hover:text-accent"
                          )}
                          onClick={() =>
                            setTripForm((current) => ({
                              ...current,
                              interests: active
                                ? current.interests.filter((item) => item !== interest)
                                : [...current.interests, interest]
                            }))
                          }
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </label>

                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setTripAdvancedExpanded((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">更多偏好</p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-slate-500 transition", tripAdvancedExpanded && "rotate-180")} />
                  </button>

                  {tripAdvancedExpanded ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-600">预算</span>
                          <select
                            className={fieldClass}
                            value={tripForm.budget}
                            onChange={(event) =>
                              setTripForm((current) => ({
                                ...current,
                                budget: event.target.value as TripRequest["budget"]
                              }))
                            }
                          >
                            <option value="value">省钱优先</option>
                            <option value="balanced">预算平衡</option>
                            <option value="premium">舒适优先</option>
                          </select>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-600">酒店区域</span>
                          <input
                            className={fieldClass}
                            value={tripForm.hotelArea ?? ""}
                            onChange={(event) => setTripForm((current) => ({ ...current, hotelArea: event.target.value }))}
                            placeholder="例如：静安寺附近"
                          />
                        </label>
                      </div>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-600">必去景点</span>
                        <input
                          className={fieldClass}
                          value={tripForm.mustVisit.join(", ")}
                          onChange={(event) =>
                            setTripForm((current) => ({
                              ...current,
                              mustVisit: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            }))
                          }
                          placeholder="用逗号分隔，例如：岳麓山, 橘子洲"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-600">补充要求</span>
                        <textarea
                          className={textAreaClass}
                          value={tripForm.notes ?? ""}
                          onChange={(event) => setTripForm((current) => ({ ...current, notes: event.target.value }))}
                          placeholder="例如：第一天不要太赶，晚餐想安排在景区附近。"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>

          <section className="space-y-4">
            <section className={panelClass}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SectionHeading
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="历史行程"
                />
                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-500">
                  共 {tripSummaries.length} 条记录
                </div>
              </div>

              {tripSummaries.length === 0 ? (
                <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-sm leading-7 text-slate-500">
                  还没有保存的行程。完成一次规划后，这里会自动出现历史记录。
                </div>
              ) : (
                <div className="mt-4 divide-y divide-slate-200">
                  {tripSummaries.map((trip) => {
                    const isSelected = selectedTrip?.id === trip.id;
                    const isLoading = loadingTripId === trip.id;
                    const isDeleting = deletingTripId === trip.id;

                    return (
                      <article key={trip.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-950">{trip.destination}</p>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium",
                                isSelected
                                  ? "border-accent/20 bg-accent/8 text-accent"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                              )}
                            >
                              {isSelected ? "当前打开" : `${trip.days} 天`}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-600">{trip.title}</p>
                          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>出发 {formatDate(trip.startDate)}</span>
                            <span>更新于 {formatDateTime(trip.updatedAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:shrink-0">
                          <button
                            type="button"
                            onClick={() => void loadTrip(trip.id)}
                            disabled={isLoading || isDeleting}
                            className={cn(
                              "rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                              isSelected
                                ? "bg-accent text-white hover:brightness-95"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-accent hover:text-accent"
                            )}
                          >
                            {isLoading ? "加载中..." : "打开"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTrip(trip.id)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            删除
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={panelClass}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                  <h2 className="mt-1.5 text-2xl font-semibold text-slate-950">
                    {selectedTrip ? selectedTrip.title : "当前编辑区"}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label="提醒"
                    value={selectedTrip ? `${issueSummary.errors} 错误 / ${issueSummary.warnings} 提醒` : "等待生成"}
                    tone={issueSummary.errors > 0 ? "accent" : "default"}
                  />
                  <button
                    type="button"
                    onClick={saveEdits}
                    disabled={!selectedTrip || isBusy}
                    className={secondaryButtonClass}
                  >
                    <Save className="mr-2 inline h-4 w-4" />
                    保存编辑
                  </button>
                  <button
                    type="button"
                  onClick={replanUnlocked}
                  disabled={!selectedTrip || isBusy || !selectedTripSupportsReplan}
                  className={accentButtonClass}
                  title={!selectedTripSupportsReplan ? "当前仅支持已收录城市的一键重排" : undefined}
                >
                    <RefreshCcw className="mr-2 inline h-4 w-4" />
                    重排未锁定项目
                  </button>
                </div>
              </div>

              {!selectedTrip ? (
                <div className="mt-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  生成后在这里编辑行程。
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">出发日期</p>
                      <p className="mt-1.5 text-base font-semibold text-slate-950">{formatDate(selectedTrip.startDate)}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">旅行人数</p>
                      <p className="mt-1.5 text-base font-semibold text-slate-950">{selectedTrip.request.travelers} 人</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">行程节奏</p>
                      <p className="mt-1.5 text-base font-semibold text-slate-950">{formatPace(selectedTrip.request.pace)}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">预算偏好</p>
                      <p className="mt-1.5 text-base font-semibold text-slate-950">{formatBudget(selectedTrip.request.budget)}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">候选点</p>
                      <p className="mt-1.5 text-base font-semibold text-slate-950">
                        {selectedTrip.itinerary.metadata.candidateCount ?? 0} 个
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTripChips.map((item) => (
                      <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {selectedTrip.itinerary.days.map((day) => (
                        <DayColumn key={day.date} day={day} onToggleLock={handleToggleLock} />
                      ))}
                    </div>
                  </DndContext>

                  <div className={cn("mt-4 grid gap-4", workspaceNotes.length > 0 && "lg:grid-cols-[minmax(0,1fr)_360px]")}>
                    {workspaceNotes.length > 0 ? (
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-accent" />
                          <h3 className="text-base font-semibold text-slate-950">规划备注</h3>
                        </div>

                        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                          {workspaceNotes.map((note) => (
                            <div key={note} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              {note}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-accent" />
                        <h3 className="text-base font-semibold text-slate-950">问题提醒</h3>
                      </div>

                      <div className="mt-3 space-y-3">
                        {activeIssues.length > 0 ? (
                          activeIssues.map((issue, index) => (
                            <div
                              key={`${issue.code}-${index}`}
                              className={cn(
                                "rounded-2xl border px-4 py-3 text-sm leading-6",
                                issue.severity === "error"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              )}
                            >
                              <p className="font-semibold">{issue.message}</p>
                              {issue.suggestion ? <p className="mt-1">{issue.suggestion}</p> : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-pine/20 bg-pine/8 px-4 py-4 text-sm leading-6 text-pine">
                            当前行程没有发现明显冲突，可以继续微调后保存。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
