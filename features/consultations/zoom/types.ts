export type ZoomMeetingJoinData =
  | {
      available: true;
      consultationId: string;
      meetingNumber: string;
      password: string;
      signature: string;
      zak?: string;
      userName: string;
      leaveUrl: string;
    }
  | {
      available: false;
      consultationId: string | null;
      message: string;
      leaveUrl: string;
    };

export type ZoomMeetingFrameAccess =
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
