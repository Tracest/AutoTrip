import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { planningTripRequestSchema } from "@/lib/schemas/trip";
import { planTrip } from "@/lib/planning/engine";
import { jsonError } from "@/lib/utils/http";
import { serializeTripDetail } from "@/lib/trips/serialization";
import { ZodError } from "zod";

type StreamEvent =
  | {
      type: "progress";
      stage: string;
      message: string;
    }
  | {
      type: "result";
      trip: ReturnType<typeof serializeTripDetail>;
    }
  | {
      type: "error";
      message: string;
    };

function line(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("未授权访问。", 401);
  }

  let parsedRequest;
  try {
    parsedRequest = planningTripRequestSchema.parse(await request.json());
  } catch (error) {
    if (
      error instanceof ZodError &&
      error.issues.some((issue) => issue.path[0] === "destination")
    ) {
      return jsonError("当前仅支持列表中的大城市，请从下拉列表重新选择目的地。", 400, error.issues);
    }

    return jsonError("行程请求参数无效。", 400, error instanceof Error ? error.message : error);
  }

  console.info("[trip-plan] Request received.", {
    userId: user.id,
    destination: parsedRequest.destination,
    days: parsedRequest.days,
    llmBaseUrl: user.llmConfig?.baseUrl ?? null,
    llmModel: user.llmConfig?.model ?? null
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(line(event)));

      try {
        const result = await planTrip({
          request: parsedRequest,
          llmConfig: user.llmConfig,
          onProgress: (event) => {
            send({
              type: "progress",
              stage: event.stage,
              message: event.message
            });
          }
        });

        const persisted = await prisma.trip.create({
          data: {
            ownerId: user.id,
            title: `${parsedRequest.destination} ${parsedRequest.days}日行程`,
            destination: parsedRequest.destination,
            startDate: new Date(parsedRequest.startDate),
            days: parsedRequest.days,
            status: "READY",
            request: parsedRequest,
            itinerary: result.itinerary,
            planningIssues: result.issues,
            lastPlannedAt: new Date()
          }
        });

        send({
          type: "progress",
          stage: "persist",
          message: "行程已保存，正在打开可编辑工作区。"
        });

        send({
          type: "result",
          trip: serializeTripDetail({
            ...persisted,
            request: parsedRequest,
            itinerary: result.itinerary
          })
        });

        console.info("[trip-plan] Trip persisted.", {
          tripId: persisted.id,
          userId: user.id,
          destination: parsedRequest.destination
        });

        controller.close();
      } catch (error) {
        console.error("[trip-plan] Planning failed.", {
          userId: user.id,
          destination: parsedRequest.destination,
          error
        });
        send({
          type: "error",
          message: error instanceof Error ? error.message : "规划过程中发生未知错误。"
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
