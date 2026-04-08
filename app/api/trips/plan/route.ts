import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { shouldPreferChineseOutput } from "@/lib/planning/destination";
import { tripRequestSchema } from "@/lib/schemas/trip";
import { planTrip } from "@/lib/planning/engine";
import { jsonError } from "@/lib/utils/http";
import { serializeTripDetail } from "@/lib/trips/serialization";

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
    return jsonError("Unauthorized.", 401);
  }

  let parsedRequest;
  try {
    parsedRequest = tripRequestSchema.parse(await request.json());
  } catch (error) {
    return jsonError("Invalid trip request.", 400, error instanceof Error ? error.message : error);
  }

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
          message: shouldPreferChineseOutput(parsedRequest.destination)
            ? "行程已保存，正在打开可编辑工作区。"
            : "Trip saved. Opening the editable itinerary workspace."
        });

        send({
          type: "result",
          trip: serializeTripDetail({
            ...persisted,
            request: parsedRequest,
            itinerary: result.itinerary
          })
        });

        controller.close();
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown planning error."
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
