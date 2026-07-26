"use client";

import Image from "next/image";
import { useState } from "react";

export function ProfileAvatar({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = displayName.trim().slice(0, 2).toUpperCase() || "CE";

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
    <Image
      src={avatarUrl}
      alt={`รูปโปรไฟล์ของ ${displayName}`}
      fill
      sizes="128px"
      className="rounded-full object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}
