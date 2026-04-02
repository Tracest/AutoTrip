"use client";

import {
  AlertTriangle,
  CalendarDays,
  GripVertical,
  LoaderCircle,
  Lock,
  MapPinned,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles
} from "lucide-react";
import { startTransition, useEffect, useState, type ReactNode } from "react";
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
import { mergeIssues, repairItinerary, validateItinerary } from "@/lib/planning/validator";
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

type DashboardClientProps = {
  userEmail: string;
  initialConfig: LlmSettingsResponse;
  initialTrips: TripSummary[];
};

type StreamEvent =
  | { type: "progress"; stage: string; message: string }
  | { type: "result"; trip: TripDetail }
  | { type: "error"; message: string };

type ApiError = {
  error?: string;
  details?: string;
};

type SectionHeadingProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "accent" | "pine";
};

const interestOptions = ["历史", "博物馆", "自然", "美食", "夜景", "亲子", "建筑", "拍照"];

const defaultTripRequest: TripRequest = {
  destination: "上海",
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

const panelClass = "rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur md:p-6";
const fieldClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";
const textAreaClass = `${fieldClass} min-h-[96px] resize-y`;
const secondaryButtonClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";
const accentButtonClass =
  "rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70";
const pineButtonClass =
  "rounded-2xl bg-pine px-4 py-3 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70";

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

function formatCandidateSource(source?: string) {
  switch (source) {
    case "amap":
      return "高德地图";
    case "llm-fallback":
      return "LLM 候选点回退";
    case "mock":
      return "占位 Mock 数据";
    default:
      return source ?? "未知";
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
      onEvent(JSON.parse(line) as StreamEvent);
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as StreamEvent);
  }
}

function recomputeItinerary(itinerary: Itinerary) {
  const repaired = repairItinerary({
    ...itinerary,
    issues: []
  });
  const mergedIssues = mergeIssues(itinerary.issues, repaired.issues);

  return {
    ...repaired.itinerary,
    issues: mergedIssues
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

function SectionHeading({ icon, title, description }: SectionHeadingProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, tone = "default" }: MetricCardProps) {
  const toneClass =
    tone === "accent"
      ? "border-accent/15 bg-accent/5"
      : tone === "pine"
        ? "border-pine/15 bg-pine/5"
        : "border-slate-200 bg-white/90";

  return (
    <div className={cn("rounded-[24px] border p-4", toneClass)}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p>
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
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{day.date}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{day.title}</h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-xs text-slate-500">
          <p>{day.totalTravelMinutes} 分通勤</p>
          <p>强度 {day.intensityScore.toFixed(1)}</p>
        </div>
      </div>
      <SortableContext items={day.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {day.items.length > 0 ? (
          <div className="mt-4 space-y-3">
            {day.items.map((item) => (
              <SortableItem key={item.id} item={item} onToggleLock={onToggleLock} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
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

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 transition active:cursor-grabbing",
        isDragging && "opacity-60 shadow-soft ring-2 ring-accent/20"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
            <GripVertical className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{item.poi.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{item.category}</p>
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

      <p className="mt-3 text-sm leading-6 text-slate-600">{item.poi.address}</p>
      {item.notes ? <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-slate-500">{item.notes}</p> : null}
    </article>
  );
}

export function DashboardClient({ userEmail, initialConfig, initialTrips }: DashboardClientProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [tripForm, setTripForm] = useState<TripRequest>(defaultTripRequest);
  const [config, setConfig] = useState({
    baseUrl: initialConfig.baseUrl ?? "",
    apiKey: "",
    model: initialConfig.model ?? "",
    temperature: initialConfig.temperature ?? 0.3,
    enabled: initialConfig.enabled ?? true
  });
  const [hasSavedConfig, setHasSavedConfig] = useState(initialConfig.configured);
  const [configStatus, setConfigStatus] = useState(initialConfig.configured ? "模型已配置，可以直接开始规划。" : "先填写模型地址和模型名。");
  const [planningStatus, setPlanningStatus] = useState("先完成模型配置，然后填写需求并开始规划。");
  const [tripSummaries, setTripSummaries] = useState<TripSummary[]>(initialTrips);
  const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(null);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [workspaceIssues, setWorkspaceIssues] = useState<PlanningIssue[]>([]);

  const activeIssues = selectedTrip?.itinerary.issues.length ? selectedTrip.itinerary.issues : workspaceIssues;
  const issueSummary = {
    warnings: activeIssues.filter((issue) => issue.severity === "warning").length,
    errors: activeIssues.filter((issue) => issue.severity === "error").length
  };
  const canPlan = tripForm.destination.trim().length > 0 && tripForm.interests.length > 0 && !isBusy;

  useEffect(() => {
    if (initialTrips[0]) {
      void loadTrip(initialTrips[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setConfigStatus("模型配置已保存。");
  }

  async function testConfig() {
    setIsBusy(true);
    setConfigStatus("正在测试模型连接...");
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
        ? `连接成功，模型返回：${payload.preview ?? "ok"}${payload.endpoint ? ` · ${payload.endpoint}` : ""}`
        : getApiErrorMessage(payload, "连接失败。")
    );
  }

  async function planTrip() {
    setIsBusy(true);
    setPlanningStatus("已提交规划请求，正在连接规划引擎...");
    const response = await fetch("/api/trips/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(tripForm)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setPlanningStatus(payload?.error ?? "规划失败。");
      setIsBusy(false);
      return;
    }

    await parseNdjson(response, (event) => {
      if (event.type === "progress") {
        setPlanningStatus(event.message);
        return;
      }

      if (event.type === "error") {
        setPlanningStatus(event.message);
        setIsBusy(false);
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
      setIsBusy(false);
    });
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
      setPlanningStatus("保存编辑失败。");
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
      setPlanningStatus("重新规划失败。");
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
      setWorkspaceIssues(validateItinerary(nextItinerary));
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

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1560px] space-y-6">
        <section className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-soft backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">AutoTrip Planner</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">AI 出游路线工作台</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                把模型配置、行程生成和拖拽编辑放在同一个页面里。先连通模型，再填写需求，最后在右侧直接检查并调整每日安排。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[560px]">
              <MetricCard label="当前账号" value={userEmail} hint="当前管理员已登录" />
              <MetricCard
                label="模型状态"
                value={hasSavedConfig ? "已配置" : "待配置"}
                hint={configStatus}
                tone={hasSavedConfig ? "pine" : "accent"}
              />
              <MetricCard
                label="已保存行程"
                value={`${tripSummaries.length} 条`}
                hint={selectedTrip ? `当前打开：${selectedTrip.destination}` : "生成后会自动加入历史记录"}
              />
              <MetricCard
                label="当前检查"
                value={`${issueSummary.errors} 个错误 / ${issueSummary.warnings} 个提醒`}
                hint={selectedTrip ? "保存前建议先处理明显冲突" : "生成行程后会在这里显示"}
                tone={issueSummary.errors > 0 ? "accent" : "default"}
              />
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">当前进度</p>
                <p className="mt-2 text-base leading-7 text-slate-700">{planningStatus}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  1. 配置模型
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  2. 填写需求
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  3. 拖拽调整并保存
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className={panelClass}>
              <SectionHeading
                icon={<Settings2 className="h-5 w-5" />}
                title="模型配置"
                description="只保留最关键的连接参数，先把模型打通。"
              />

              <div className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">Base URL</span>
                  <input
                    className={fieldClass}
                    value={config.baseUrl}
                    onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))}
                    placeholder="https://api.openai.com/v1"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    支持基础 URL，也支持完整的 `/chat/completions` 地址，不要填写 `/responses`。
                  </p>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">API Key</span>
                  <input
                    className={fieldClass}
                    type="password"
                    value={config.apiKey}
                    onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))}
                    placeholder="sk-..."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-600">Model</span>
                    <input
                      className={fieldClass}
                      value={config.model}
                      onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))}
                      placeholder="gpt-4.1-mini"
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

                <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span>启用 LLM 精修</span>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={testConfig} disabled={isBusy} className={secondaryButtonClass}>
                  测试连接
                </button>
                <button type="button" onClick={saveConfig} disabled={isBusy} className={accentButtonClass}>
                  保存配置
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {configStatus}
              </div>
            </section>

            <section className={panelClass}>
              <SectionHeading
                icon={<MapPinned className="h-5 w-5" />}
                title="新建行程"
                description="按最常用的顺序填写，生成后会自动进入右侧编辑区。"
              />

              <div className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">目的地</span>
                  <input
                    className={fieldClass}
                    value={tripForm.destination}
                    onChange={(event) => setTripForm((current) => ({ ...current, destination: event.target.value }))}
                    placeholder="例如：长沙"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
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

                <div className="grid gap-4 sm:grid-cols-2">
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

                <div className="grid gap-4 sm:grid-cols-2">
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
                  <p className="text-xs leading-5 text-slate-500">至少选择 1 个兴趣标签，模型会据此安排风格。</p>
                </label>

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

              <button type="button" onClick={planTrip} disabled={!canPlan} className={cn("mt-5 w-full", pineButtonClass)}>
                {isBusy ? "规划中..." : "开始规划路线"}
              </button>
            </section>
          </aside>

          <section className="space-y-6">
            <section className={panelClass}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <SectionHeading
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="历史行程"
                  description="从这里快速切换已有路线，不用反复返回。"
                />
                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                  共 {tripSummaries.length} 条记录
                </div>
              </div>

              {tripSummaries.length === 0 ? (
                <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm leading-7 text-slate-500">
                  还没有保存的行程。完成一次规划后，这里会自动出现历史记录。
                </div>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {tripSummaries.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => void loadTrip(trip.id)}
                      className={cn(
                        "rounded-[24px] border px-4 py-4 text-left transition",
                        selectedTrip?.id === trip.id
                          ? "border-accent bg-accent/6 shadow-[0_12px_30px_rgba(208,91,50,0.12)]"
                          : "border-slate-200 bg-slate-50/80 hover:border-accent/35 hover:bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-950">{trip.destination}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{trip.title}</p>
                        </div>
                        {loadingTripId === trip.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                            {trip.days} 天
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>出发 {formatDate(trip.startDate)}</span>
                        <span>更新于 {formatDateTime(trip.updatedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className={panelClass}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {selectedTrip ? selectedTrip.title : "当前编辑区"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                    {selectedTrip
                      ? "拖拽卡片可以调整顺序，锁定关键地点后再重排未锁定项目。"
                      : "生成新行程后，右侧会显示每天安排、问题提醒和保存操作。"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {issueSummary.errors} 个错误 · {issueSummary.warnings} 个提醒
                  </div>
                  <button
                    type="button"
                    onClick={saveEdits}
                    disabled={!selectedTrip || isBusy}
                    className={secondaryButtonClass}
                  >
                    <Save className="mr-2 inline h-4 w-4" />
                    保存编辑
                  </button>
                  <button type="button" onClick={replanUnlocked} disabled={!selectedTrip || isBusy} className={accentButtonClass}>
                    <RefreshCcw className="mr-2 inline h-4 w-4" />
                    重排未锁定项目
                  </button>
                </div>
              </div>

              {!selectedTrip ? (
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-6">
                    <p className="text-sm font-semibold text-slate-950">先连接模型</p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">填写 Base URL、Key 和模型名，确保测试连接成功。</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-6">
                    <p className="text-sm font-semibold text-slate-950">再填写需求</p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">目的地、日期、天数和兴趣标签是最核心的输入项。</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-6">
                    <p className="text-sm font-semibold text-slate-950">最后直接编辑</p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">生成后就在这里拖拽、锁定、检查问题并保存。</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">出发日期</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(selectedTrip.startDate)}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">旅行人数</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">{selectedTrip.request.travelers} 人</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">行程节奏</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">{formatPace(selectedTrip.request.pace)}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">候选点</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {selectedTrip.itinerary.metadata.candidateCount ?? 0} 个
                        </p>
                      </div>
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {selectedTrip.itinerary.days.map((day) => (
                          <DayColumn key={day.date} day={day} onToggleLock={handleToggleLock} />
                        ))}
                      </div>
                    </DndContext>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50/90 p-5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-accent" />
                        <h3 className="text-base font-semibold text-slate-950">需求摘要</h3>
                      </div>

                      <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                        <div>
                          <p className="font-medium text-slate-950">目的地</p>
                          <p>{selectedTrip.request.destination}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-950">兴趣标签</p>
                          <p>{selectedTrip.request.interests.join(" / ")}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-950">预算偏好</p>
                          <p>{formatBudget(selectedTrip.request.budget)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-950">候选点来源</p>
                          <p>{formatCandidateSource(selectedTrip.itinerary.metadata.candidateSource)}</p>
                        </div>
                        {selectedTrip.request.mustVisit.length > 0 ? (
                          <div>
                            <p className="font-medium text-slate-950">必去景点</p>
                            <p>{selectedTrip.request.mustVisit.join(" / ")}</p>
                          </div>
                        ) : null}
                        {selectedTrip.request.hotelArea ? (
                          <div>
                            <p className="font-medium text-slate-950">酒店区域</p>
                            <p>{selectedTrip.request.hotelArea}</p>
                          </div>
                        ) : null}
                        {selectedTrip.request.notes ? (
                          <div>
                            <p className="font-medium text-slate-950">补充要求</p>
                            <p>{selectedTrip.request.notes}</p>
                          </div>
                        ) : null}
                        {selectedTrip.itinerary.metadata.betaNotice ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                            {selectedTrip.itinerary.metadata.betaNotice}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-slate-200 bg-slate-50/90 p-5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-accent" />
                        <h3 className="text-base font-semibold text-slate-950">问题提醒</h3>
                      </div>

                      <div className="mt-4 space-y-3">
                        {activeIssues.length > 0 ? (
                          activeIssues.map((issue, index) => (
                            <div
                              key={`${issue.code}-${index}`}
                              className={cn(
                                "rounded-2xl border px-4 py-4 text-sm leading-6",
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
                  </aside>
                </div>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
