import { getBookedConsultationDurationMinutes } from "@/features/consultations/duration-policy";

export type ConsultationAttendanceEventRecord = {
  role: "doctor" | "customer";
  eventType: "joined" | "left";
  meetingUuidHash: string;
  participantSessionHash: string;
  occurredAt: Date;
};

export type ConsultationAttendanceState = {
  doctorEverJoined: boolean;
  customerEverJoined: boolean;
  bothJoinedSameMeeting: boolean;
  normalCompletionEligible: boolean;
  noShowCompletionEligible: boolean;
  requiredDurationMinutes: number;
  requiredDoctorPresenceSeconds: number;
  verifiedDoctorPresenceSeconds: number;
  longestVerifiedDoctorPresenceSeconds: number;
  activeDoctorPresenceSeconds: number;
  doctorCurrentlyPresent: boolean;
  customerCurrentlyPresent: boolean;
  allParticipantsHaveLeft: boolean;
  noShowRemainingSeconds: number | null;
};

function secondsBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

type AttendanceInterval = {
  role: "doctor" | "customer";
  meetingUuidHash: string;
  startedAt: Date;
  endedAt: Date;
};

function getSessionKey(event: ConsultationAttendanceEventRecord) {
  return [event.role, event.meetingUuidHash, event.participantSessionHash].join(":");
}

function intervalsOverlap(left: AttendanceInterval, right: AttendanceInterval) {
  const overlapStartedAt = Math.max(left.startedAt.getTime(), right.startedAt.getTime());
  const overlapEndedAt = Math.min(left.endedAt.getTime(), right.endedAt.getTime());

  return overlapEndedAt > overlapStartedAt;
}

export function getConsultationAttendanceState(
  events: ConsultationAttendanceEventRecord[],
  scheduledAt: Date | null,
  bookedDurationMinutes?: number | null,
  now = new Date()
): ConsultationAttendanceState {
  const requiredDurationMinutes = getBookedConsultationDurationMinutes(bookedDurationMinutes);
  const requiredDoctorPresenceSeconds = requiredDurationMinutes * 60;
  const ordered = [...events].sort((left, right) => {
    const timeDifference = left.occurredAt.getTime() - right.occurredAt.getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return left.eventType === right.eventType ? 0 : left.eventType === "joined" ? -1 : 1;
  });
  const doctorMeetings = new Set<string>();
  const customerMeetings = new Set<string>();
  const activeSessions = new Map<
    string,
    Pick<AttendanceInterval, "role" | "meetingUuidHash" | "startedAt">
  >();
  const attendanceIntervals: AttendanceInterval[] = [];
  let longestVerifiedDoctorPresenceSeconds = 0;

  for (const event of ordered) {
    const sessionKey = getSessionKey(event);

    if (event.eventType === "joined") {
      (event.role === "doctor" ? doctorMeetings : customerMeetings).add(event.meetingUuidHash);

      if (!activeSessions.has(sessionKey)) {
        activeSessions.set(sessionKey, {
          role: event.role,
          meetingUuidHash: event.meetingUuidHash,
          startedAt: event.occurredAt
        });
      }

      continue;
    }

    const activeSession = activeSessions.get(sessionKey);

    if (!activeSession) {
      continue;
    }

    attendanceIntervals.push({
      ...activeSession,
      endedAt: event.occurredAt
    });

    if (event.role === "doctor") {
      const effectiveStart =
        scheduledAt && scheduledAt > activeSession.startedAt
          ? scheduledAt
          : activeSession.startedAt;
      longestVerifiedDoctorPresenceSeconds = Math.max(
        longestVerifiedDoctorPresenceSeconds,
        secondsBetween(effectiveStart, event.occurredAt)
      );
    }

    activeSessions.delete(sessionKey);
  }

  let activeDoctorPresenceSeconds = 0;

  for (const activeSession of activeSessions.values()) {
    attendanceIntervals.push({
      ...activeSession,
      endedAt: now
    });

    if (activeSession.role === "doctor") {
      const effectiveStart =
        scheduledAt && scheduledAt > activeSession.startedAt
          ? scheduledAt
          : activeSession.startedAt;
      activeDoctorPresenceSeconds = Math.max(
        activeDoctorPresenceSeconds,
        secondsBetween(effectiveStart, now)
      );
    }
  }

  const doctorEverJoined = doctorMeetings.size > 0;
  const customerEverJoined = customerMeetings.size > 0;
  const doctorIntervals = attendanceIntervals.filter((interval) => interval.role === "doctor");
  const customerIntervals = attendanceIntervals.filter((interval) => interval.role === "customer");
  const bothJoinedSameMeeting = doctorIntervals.some((doctorInterval) =>
    customerIntervals.some(
      (customerInterval) =>
        customerInterval.meetingUuidHash === doctorInterval.meetingUuidHash &&
        intervalsOverlap(doctorInterval, customerInterval)
    )
  );
  const doctorCurrentlyPresent = [...activeSessions.values()].some(
    (session) => session.role === "doctor"
  );
  const customerCurrentlyPresent = [...activeSessions.values()].some(
    (session) => session.role === "customer"
  );
  const allParticipantsHaveLeft = activeSessions.size === 0;
  const verifiedDoctorPresenceSeconds = Math.max(
    longestVerifiedDoctorPresenceSeconds,
    activeDoctorPresenceSeconds
  );
  const doctorPresenceRequirementMet =
    verifiedDoctorPresenceSeconds >= requiredDoctorPresenceSeconds;
  const noShowCompletionEligible =
    !customerEverJoined && doctorPresenceRequirementMet;
  const activeIntervalRemainingSeconds = Math.max(
    0,
    requiredDoctorPresenceSeconds - activeDoctorPresenceSeconds
  );

  return {
    doctorEverJoined,
    customerEverJoined,
    bothJoinedSameMeeting,
    normalCompletionEligible: bothJoinedSameMeeting && allParticipantsHaveLeft,
    noShowCompletionEligible,
    requiredDurationMinutes,
    requiredDoctorPresenceSeconds,
    verifiedDoctorPresenceSeconds,
    longestVerifiedDoctorPresenceSeconds,
    activeDoctorPresenceSeconds,
    doctorCurrentlyPresent,
    customerCurrentlyPresent,
    allParticipantsHaveLeft,
    noShowRemainingSeconds: customerEverJoined
      ? null
      : doctorPresenceRequirementMet
        ? 0
        : doctorCurrentlyPresent
          ? activeIntervalRemainingSeconds
          : requiredDoctorPresenceSeconds
  };
}

function formatRemainingDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} วินาที`;
  }

  return `ประมาณ ${Math.ceil(seconds / 60)} นาที`;
}

export function getAttendanceStatusCopy(
  state: ConsultationAttendanceState,
  viewerRole: "doctor" | "customer"
) {
  if (state.normalCompletionEligible) {
    return {
      label: "Zoom ยืนยันว่าทั้งสองฝ่ายออกจากห้องแล้ว",
      description: "แพทย์และผู้ป่วยเคยอยู่พร้อมกันในห้องนัดหมายเดียวกัน และขณะนี้ออกจากห้อง Zoom ครบทั้งสองฝ่ายแล้ว",
      tone: "success" as const
    };
  }

  if (state.bothJoinedSameMeeting) {
    return {
      label: "Zoom ยืนยันผู้เข้าร่วมครบแล้ว • รอออกจากห้อง",
      description: "กรุณาให้แพทย์และผู้ป่วยออกจากห้อง Zoom ให้ครบก่อนยืนยันจบการปรึกษา",
      tone: "warning" as const
    };
  }

  if (state.customerEverJoined) {
    if (state.doctorEverJoined) {
      return {
        label: "ยังไม่ยืนยันว่าอยู่ใน Zoom พร้อมกัน",
        description: "ต้องมีช่วงที่แพทย์และผู้ป่วยอยู่ในห้องเดียวกันพร้อมกัน และออกจากห้องครบทั้งสองฝ่าย",
        tone: "warning" as const
      };
    }

    return {
      label: viewerRole === "doctor" ? "ยืนยันผู้ป่วยแล้ว • รอแพทย์" : "Zoom ยืนยันคุณแล้ว • รอแพทย์",
      description: "ระบบจะเปิดขั้นตอนจบการปรึกษาหลัง Zoom ยืนยันแพทย์ในห้องเดียวกัน",
      tone: "warning" as const
    };
  }

  if (state.noShowCompletionEligible) {
    return {
      label: `ยืนยันเวลารอครบ ${state.requiredDurationMinutes} นาทีแล้ว`,
      description: "ผู้ป่วยยังไม่เข้าห้อง สามารถบันทึกผลไม่มาตามนัดจากคิวแพทย์ได้",
      tone: "warning" as const
    };
  }

  if (state.doctorEverJoined) {
    return {
      label: viewerRole === "doctor" ? "Zoom ยืนยันแพทย์แล้ว • รอผู้ป่วย" : "แพทย์อยู่ใน Zoom แล้ว",
      description:
        viewerRole === "doctor"
          ? state.doctorCurrentlyPresent
            ? `ต้องอยู่ต่อเนื่องอีก ${formatRemainingDuration(state.noShowRemainingSeconds ?? state.requiredDoctorPresenceSeconds)} ให้ครบ ${state.requiredDurationMinutes} นาที หากผู้ป่วยไม่เข้าห้อง`
            : `ช่วงก่อนหน้าสิ้นสุดก่อนครบเวลา ต้องเข้าห้องและอยู่ต่อเนื่องใหม่ให้ครบ ${state.requiredDurationMinutes} นาที`
          : "กรุณากดเปิดห้อง Zoom เพื่อให้ระบบยืนยันการเข้าร่วมของคุณ",
      tone: "warning" as const
    };
  }

  return {
    label: "รอการยืนยันจาก Zoom",
    description:
      viewerRole === "doctor"
        ? "กดเข้าห้อง Zoom และรอให้ Zoom ส่งหลักฐานการเข้าร่วม"
        : "เมื่อแพทย์เปิดห้องแล้ว กรุณากดเข้าห้อง Zoom เพื่อยืนยันการเข้าร่วม",
    tone: "neutral" as const
  };
}
