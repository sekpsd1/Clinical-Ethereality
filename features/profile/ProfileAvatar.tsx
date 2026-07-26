"use client";

import { useEffect, useState } from "react";

export function ProfileAvatar({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = displayName.trim().slice(0, 2).toUpperCase() || "CE";

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  if (!avatarUrl || imageFailed) {
    return (
      <div
        role="img"
        aria-label={`รูปโปรไฟล์ของ ${displayName}`}
        className="flex h-full w-full items-center justify-center rounded-full bg-[#e3f3f1] text-3xl font-bold text-primary"
      >
        {initials}
      </div>
    );
  }

  return (
    // LINE profile URLs are already optimized by LINE's CDN. A native image avoids
    // host validation and optimizer behavior that differs between LIFF and Plesk.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={`รูปโปรไฟล์ของ ${displayName}`}
      referrerPolicy="no-referrer"
      className="absolute inset-0 h-full w-full rounded-full object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}
