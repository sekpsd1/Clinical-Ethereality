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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  // Render the chosen doctor's URL immediately. Waiting for hydration made the
  // server fallback avatar visible on slower mobile connections.
  const imageSrc = !src || imageFailed ? fallbackSrc : src;

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
