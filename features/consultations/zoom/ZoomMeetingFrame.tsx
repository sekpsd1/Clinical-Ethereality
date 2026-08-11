"use client";

export function ZoomMeetingFrame({ consultationId }: { consultationId: string }) {
  const source = `/zoom-sdk/index.html?consultation=${encodeURIComponent(consultationId)}`;

  return (
    <iframe
      allow="camera; microphone; display-capture; fullscreen"
      className="min-h-dvh w-full border-0 bg-app"
      referrerPolicy="same-origin"
      src={source}
      title="Zoom Consultation"
    />
  );
}
