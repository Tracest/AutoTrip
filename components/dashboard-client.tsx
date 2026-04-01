"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
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
import { CalendarDays, LoaderCircle, Lock, MapPinned, RefreshCcw, Save, Sparkles } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric"
  });
}

function isTripDetail(payload: TripDetail | ApiError): payload is TripDetail {
  return !("error" in payload);
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

function DayColumn({
  day,
  onToggleLock
}: {
  day: ItineraryDay;
  onToggleLock: (itemId: string) => void;
}) {
  return (
    <div className="min-w-[290px] rounded-[24px] border border-black/8 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">{day.date}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{day.title}</h3>
        </div>
        <div className="rounded-2xl bg-mist px-3 py-2 text-right text-xs text-black/55">
          <p>通勤 {day.totalTravelMinutes} 分</p>
          <p>强度 {day.intensityScore.toFixed(1)}</p>
        </div>
      </div>
      <SortableContext items={day.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {day.items.map((item) => (
            <SortableItem key={item.id} item={item} onToggleLock={onToggleLock} />
          ))}
        </div>
      </SortableContext>
    </div>
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
        "rounded-[20px] border border-black/8 bg-mist px-4 py-4 transition",
        isDragging && "opacity-60 shadow-soft"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{item.poi.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-black/45">{item.category}</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock(item.id);
          }}
          className={cn(
            "rounded-full border px-2 py-1 text-xs font-medium transition",
            item.locked
              ? "border-pine/35 bg-pine/10 text-pine"
              : "border-black/10 bg-white text-black/55 hover:border-accent/30 hover:text-accent"
          )}
        >
          <Lock className="mr-1 inline h-3 w-3" />
          {item.locked ? "已锁定" : "锁定"}
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-black/65">
        <span>
          {item.startTime} - {item.endTime}
        </span>
        <span>{item.durationMinutes} 分钟</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-black/58">{item.poi.address}</p>
      {item.notes ? <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-sm text-black/55">{item.notes}</p> : null}
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
  const [configStatus, setConfigStatus] = useState(initialConfig.configured ? "模型已配置" : "尚未配置模型");
  const [planningStatus, setPlanningStatus] = useState("等待新的行程规划请求。");
  const [tripSummaries, setTripSummaries] = useState<TripSummary[]>(initialTrips);
  const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(null);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [workspaceIssues, setWorkspaceIssues] = useState<PlanningIssue[]>([]);

  const issueSummary = useMemo(() => {
    const issues = selectedTrip?.itinerary.issues ?? workspaceIssues;
    return {
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      errors: issues.filter((issue) => issue.severity === "error").length
    };
  }, [selectedTrip?.itinerary.issues, workspaceIssues]);

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
    const payload = (await response.json()) as { error?: string };
    setIsBusy(false);
    setConfigStatus(response.ok ? "模型配置已保存。" : payload.error ?? "保存失败。");
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
    const payload = (await response.json()) as { error?: string; preview?: string };
    setIsBusy(false);
    setConfigStatus(response.ok ? `连接成功，模型返回：${payload.preview ?? "ok"}` : payload.error ?? "连接失败。");
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
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto grid max-w-[1560px] gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-[30px] bg-ink p-6 text-white shadow-soft">
            <p className="text-sm uppercase tracking-[0.22em] text-white/55">AutoTrip Dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold">AI 出游路线工作台</h1>
            <p className="mt-4 text-sm leading-7 text-white/75">
              当前登录账号：{userEmail}
              <br />
              先配置 OpenAI 兼容模型，再生成并编辑你的多日行程。
            </p>
            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/72">
              <p className="font-medium text-white">规划引擎状态</p>
              <p className="mt-2 leading-6">{planningStatus}</p>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold">模型配置</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-black/60">Base URL</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
                  value={config.baseUrl}
                  onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-black/60">API Key</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
                  type="password"
                  value={config.apiKey}
                  onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder="sk-..."
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-black/60">Model</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
                  value={config.model}
                  onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))}
                  placeholder="gpt-4o-mini"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-black/60">Temperature</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
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
              <label className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3 text-sm text-black/65">
                <span>启用 LLM 精修</span>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={testConfig}
                className="flex-1 rounded-2xl border border-black/10 px-4 py-3 text-sm font-medium text-black/72 transition hover:border-accent hover:text-accent"
              >
                测试连接
              </button>
              <button
                type="button"
                onClick={saveConfig}
                className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:brightness-95"
              >
                保存配置
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-black/58">{configStatus}</p>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-pine" />
              <h2 className="text-xl font-semibold">新的出游请求</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-black/60">目的地</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
                  value={tripForm.destination}
                  onChange={(event) => setTripForm((current) => ({ ...current, destination: event.target.value }))}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-black/60">出发日期</span>
                  <input
                    className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
                    type="date"
                    value={tripForm.startDate}
                    onChange={(event) => setTripForm((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-black/60">天数</span>
                  <input
                    className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
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
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-black/60">同行人数</span>
                  <input
                    className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
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
                  <span className="text-sm text-black/60">节奏</span>
                  <select
                    className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
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
                <span className="text-sm text-black/60">兴趣标签</span>
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
                            : "border-black/10 bg-mist text-black/65 hover:border-accent/30 hover:text-accent"
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
              <label className="block space-y-2">
                <span className="text-sm text-black/60">必去景点（逗号分隔）</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
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
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-black/60">酒店区域</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-mist px-4 py-3 outline-none transition focus:border-accent"
                  value={tripForm.hotelArea ?? ""}
                  onChange={(event) => setTripForm((current) => ({ ...current, hotelArea: event.target.value }))}
                  placeholder="例如：静安寺 / 东京站 / 巴黎歌剧院附近"
                />
              </label>
              <button
                type="button"
                onClick={planTrip}
                disabled={isBusy}
                className="w-full rounded-2xl bg-pine px-4 py-3 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusy ? "规划中..." : "开始规划路线"}
              </button>
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
            <div className="rounded-[28px] bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-black/45">Saved Trips</p>
                  <h2 className="mt-2 text-2xl font-semibold">已保存行程</h2>
                </div>
                <CalendarDays className="h-5 w-5 text-black/35" />
              </div>
              <div className="mt-5 space-y-3">
                {tripSummaries.length === 0 ? (
                  <p className="rounded-2xl bg-mist px-4 py-4 text-sm leading-6 text-black/55">
                    还没有保存的行程。完成一次规划后，这里会出现历史记录。
                  </p>
                ) : (
                  tripSummaries.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => void loadTrip(trip.id)}
                      className={cn(
                        "w-full rounded-[22px] border px-4 py-4 text-left transition",
                        selectedTrip?.id === trip.id
                          ? "border-accent bg-accent/8"
                          : "border-black/8 bg-mist hover:border-accent/25"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{trip.destination}</p>
                          <p className="mt-1 text-sm text-black/55">{trip.title}</p>
                        </div>
                        {loadingTripId === trip.id ? <LoaderCircle className="h-4 w-4 animate-spin text-accent" /> : null}
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-black/40">
                        {formatDate(trip.startDate)} · {trip.days} days
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-black/45">Workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {selectedTrip ? selectedTrip.title : "等待生成一个新的可编辑行程"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-mist px-4 py-3 text-sm text-black/58">
                    {issueSummary.errors} errors · {issueSummary.warnings} warnings
                  </div>
                  <button
                    type="button"
                    onClick={saveEdits}
                    disabled={!selectedTrip || isBusy}
                    className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-medium text-black/72 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="mr-2 inline h-4 w-4" />
                    保存编辑
                  </button>
                  <button
                    type="button"
                    onClick={replanUnlocked}
                    disabled={!selectedTrip || isBusy}
                    className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCcw className="mr-2 inline h-4 w-4" />
                    重排未锁定项目
                  </button>
                </div>
              </div>

              {!selectedTrip ? (
                <div className="mt-8 rounded-[26px] border border-dashed border-black/10 bg-mist p-10 text-center text-black/55">
                  配置模型后，在左侧填写出游请求并开始规划。生成后的路线会出现在这里，并支持拖拽编辑。
                </div>
              ) : (
                <>
                  <div className="mt-6 rounded-[26px] bg-mist px-5 py-4 text-sm leading-7 text-black/58">
                    <p>
                      <span className="font-medium text-ink">目的地：</span>
                      {selectedTrip.request.destination} · {selectedTrip.request.days} 天 · {selectedTrip.request.travelers} 人
                    </p>
                    <p>
                      <span className="font-medium text-ink">兴趣：</span>
                      {selectedTrip.request.interests.join(" / ")}
                    </p>
                    {selectedTrip.itinerary.metadata.betaNotice ? (
                      <p className="text-accent">{selectedTrip.itinerary.metadata.betaNotice}</p>
                    ) : null}
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="mt-6 flex gap-5 overflow-x-auto pb-2">
                      {selectedTrip.itinerary.days.map((day) => (
                        <DayColumn key={day.date} day={day} onToggleLock={handleToggleLock} />
                      ))}
                    </div>
                  </DndContext>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {(selectedTrip.itinerary.issues.length ? selectedTrip.itinerary.issues : workspaceIssues).map((issue, index) => (
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
                    ))}
                    {selectedTrip.itinerary.issues.length === 0 && workspaceIssues.length === 0 ? (
                      <div className="rounded-2xl border border-pine/20 bg-pine/8 px-4 py-4 text-sm leading-6 text-pine">
                        当前行程没有发现明显冲突。你可以继续拖拽调整，或者锁定关键景点后重排其余项目。
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
