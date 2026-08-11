// Zoom's Meeting SDK browser-support policy, scoped only to its isolated iframe assets.
export const ZOOM_SDK_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "worker-src blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://zoom.us *.zoom.us dmogdx0jrul3u.cloudfront.net blob:",
  "connect-src 'self' https://zoom.us https://*.zoom.us wss://*.zoom.us",
  "img-src 'self' https:",
  "media-src 'self' https:",
  "font-src 'self' https:",
].join("; ");

export const ZOOM_SDK_CSP_HEADER = {
  key: "Content-Security-Policy",
  value: ZOOM_SDK_CONTENT_SECURITY_POLICY,
};
