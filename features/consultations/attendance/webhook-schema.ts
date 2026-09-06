import { z } from "zod";

const meetingId = z.union([z.string().min(1).max(32), z.number().int().nonnegative()]).transform(String);
const participantEvent = z.object({
  event: z.enum(["meeting.participant_joined", "meeting.participant_left"]),
  event_ts: z.number().int().nonnegative(),
  payload: z.object({
    object: z.object({
      id: meetingId,
      uuid: z.string().min(1).max(191),
      participant: z.object({
        customer_key: z.string().regex(/^[A-Za-z0-9]{33}$/),
        user_id: z.string().min(1).max(191),
        join_time: z.string().datetime({ offset: true }).optional(),
        leave_time: z.string().datetime({ offset: true }).optional()
      })
    })
  })
});

export type ZoomParticipantAttendanceEvent = {
  eventType: "joined" | "left";
  meetingId: string;
  meetingUuid: string;
  participantUserId: string;
  customerKey: string;
  occurredAt: Date;
};

export function parseZoomParticipantAttendanceEvent(body: unknown): ZoomParticipantAttendanceEvent | null {
  const parsed = participantEvent.safeParse(body);

  if (!parsed.success) {
    return null;
  }

  const isJoined = parsed.data.event === "meeting.participant_joined";
  const occurredAtValue = isJoined
    ? parsed.data.payload.object.participant.join_time
    : parsed.data.payload.object.participant.leave_time;

  if (!occurredAtValue) {
    return null;
  }

  const occurredAt = new Date(occurredAtValue);

  if (!Number.isFinite(occurredAt.getTime())) {
    return null;
  }

  return {
    eventType: isJoined ? "joined" : "left",
    meetingId: parsed.data.payload.object.id,
    meetingUuid: parsed.data.payload.object.uuid,
    participantUserId: parsed.data.payload.object.participant.user_id,
    customerKey: parsed.data.payload.object.participant.customer_key,
    occurredAt
  };
}
