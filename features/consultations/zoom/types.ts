export type ZoomMeetingJoinData =
  | {
      available: true;
      consultationId: string;
      meetingNumber: string;
      password: string;
      signature: string;
      userName: string;
      leaveUrl: string;
    }
  | {
      available: false;
      consultationId: string | null;
      message: string;
      leaveUrl: string;
    };
