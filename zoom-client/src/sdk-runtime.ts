export function createZoomClientInitOptions(
  leaveUrl: string,
  success: () => void,
  error: (reason: unknown) => void
) {
  return {
    leaveUrl,
    patchJsMedia: true,
    disablePreview: true,
    disableRecord: true,
    leaveOnPageUnload: true,
    success,
    error
  } as const;
}

type ZoomClientRoot = {
  style: {
    display: string;
  };
};

export function revealZoomClientRoot(root: ZoomClientRoot | null) {
  if (!root) {
    throw new Error("zoom_client_sdk_root_missing");
  }

  root.style.display = "block";
}
