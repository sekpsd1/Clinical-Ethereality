export type ZoomMeetingJoinData =
  | {
      available: true;
      consultationId: string;
      meetingNumber: string;
      password: string;
      signature: string;
      zak?: string;
      userName: string;
      customerKey: string;
      leaveUrl: string;
    }
  | {
      available: false;
      consultationId: string | null;
      message: string;
      leaveUrl: string;
    };

export type ZoomMeetingLaunchAccess =
  | {
      available: true;
      consultationId: string;
      leaveUrl: string;
    }
  | {
      available: false;
      consultationId: string | null;
      message: string;
      leaveUrl: string;
    };
