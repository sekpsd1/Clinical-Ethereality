"use client";

import { useEffect, useState } from "react";

const fallbackDoctorImage = "/images/doctors/kamonpat.jpg";

export function DoctorAvatar({
  src,
  alt,
  fallbackSrc = fallbackDoctorImage
}: {
  src: string | null | undefined;
  alt: string;
  fallbackSrc?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setIsMounted(true);
  }, [src]);

  const imageSrc = !isMounted || !src || imageFailed ? fallbackSrc : src;

  return (
    // Staff profile photos can be served by the private host route. A native image
    // lets the customer UI fall back cleanly when a database clone has no file bytes.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => {
        if (!imageFailed) {
          setImageFailed(true);
        }
      }}
    />
  );
}
