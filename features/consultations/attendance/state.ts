export const NO_SHOW_WAIT_SECONDS = 10 * 60;

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
  longestVerifiedDoctorPresenceSeconds: number;
  activeDoctorPresenceSeconds: number;
  noShowRemainingSeconds: number | null;
};

function secondsBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

export function getConsultationAttendanceState(
  events: ConsultationAttendanceEventRecord[],
  scheduledAt: Date | null,
  now = new Date()
): ConsultationAttendanceState {
  const ordered = [...events].sort((left, right) => {
    const timeDifference = left.occurredAt.getTime() - right.occurredAt.getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return left.eventType === right.eventType ? 0 : left.eventType === "joined" ? -1 : 1;
  });
  const doctorMeetings = new Set<string>();
  const customerMeetings = new Set<string>();
  const activeDoctorSessions = new Map<string, Date>();
  let longestVerifiedDoctorPresenceSeconds = 0;

  for (const event of ordered) {
    if (event.eventType === "joined") {
      (event.role === "doctor" ? doctorMeetings : customerMeetings).add(event.meetingUuidHash);

      if (event.role === "doctor" && !activeDoctorSessions.has(event.participantSessionHash)) {
        activeDoctorSessions.set(event.participantSessionHash, event.occurredAt);
      }

      continue;
    }

    if (event.role !== "doctor") {
      continue;
    }

    const joinedAt = activeDoctorSessions.get(event.participantSessionHash);

    if (!joinedAt) {
      continue;
    }

    const effectiveStart = scheduledAt && scheduledAt > joinedAt ? scheduledAt : joinedAt;
    longestVerifiedDoctorPresenceSeconds = Math.max(
      longestVerifiedDoctorPresenceSeconds,
      secondsBetween(effectiveStart, event.occurredAt)
    );
    activeDoctorSessions.delete(event.participantSessionHash);
  }

  let activeDoctorPresenceSeconds = 0;

  for (const joinedAt of activeDoctorSessions.values()) {
    const effectiveStart = scheduledAt && scheduledAt > joinedAt ? scheduledAt : joinedAt;
    activeDoctorPresenceSeconds = Math.max(
      activeDoctorPresenceSeconds,
      secondsBetween(effectiveStart, now)
    );
  }

  const doctorEverJoined = doctorMeetings.size > 0;
  const customerEverJoined = customerMeetings.size > 0;
  const bothJoinedSameMeeting = [...doctorMeetings].some((meeting) => customerMeetings.has(meeting));
  const noShowCompletionEligible =
    !customerEverJoined && longestVerifiedDoctorPresenceSeconds >= NO_SHOW_WAIT_SECONDS;

  return {
    doctorEverJoined,
    customerEverJoined,
    bothJoinedSameMeeting,
    normalCompletionEligible: bothJoinedSameMeeting,
    noShowCompletionEligible,
    longestVerifiedDoctorPresenceSeconds,
    activeDoctorPresenceSeconds,
    noShowRemainingSeconds: customerEverJoined
      ? null
      : Math.max(
          0,
          NO_SHOW_WAIT_SECONDS -
            Math.max(longestVerifiedDoctorPresenceSeconds, activeDoctorPresenceSeconds)
        )
  };
}

export function getAttendanceStatusCopy(
  state: ConsultationAttendanceState,
  viewerRole: "doctor" | "customer"
) {
  if (state.normalCompletionEligible) {
    return {
      label: "Zoom ยืนยันผู้เข้าร่วมครบแล้ว",
      description: "Zoom ยืนยันว่าแพทย์และผู้ป่วยเข้าห้องนัดหมายเดียวกันแล้ว",
      tone: "success" as const
    };
  }

  if (state.customerEverJoined) {
    return {
      label: viewerRole === "doctor" ? "ยืนยันผู้ป่วยแล้ว • รอแพทย์" : "Zoom ยืนยันคุณแล้ว • รอแพทย์",
      description: "ระบบจะเปิดขั้นตอนจบการปรึกษาหลัง Zoom ยืนยันแพทย์ในห้องเดียวกัน",
      tone: "warning" as const
    };
  }

  if (state.noShowCompletionEligible) {
    return {
      label: "ยืนยันเวลารอครบ 10 นาทีแล้ว",
      description: "ผู้ป่วยยังไม่เข้าห้อง สามารถบันทึกผลไม่มาตามนัดจากคิวแพทย์ได้",
      tone: "warning" as const
    };
  }

  if (state.doctorEverJoined) {
    const minutes = Math.ceil((state.noShowRemainingSeconds ?? 0) / 60);

    return {
      label: viewerRole === "doctor" ? "Zoom ยืนยันแพทย์แล้ว • รอผู้ป่วย" : "แพทย์อยู่ใน Zoom แล้ว",
      description:
        viewerRole === "doctor"
          ? state.activeDoctorPresenceSeconds >= NO_SHOW_WAIT_SECONDS
            ? "ครบเวลารอแล้ว กรุณาออกจาก Zoom เพื่อให้ event การออกยืนยันช่วงเวลาต่อเนื่องก่อนบันทึก no-show"
            : `ต้องรอต่อเนื่องอีกประมาณ ${minutes} นาที หากผู้ป่วยไม่เข้าห้อง`
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
