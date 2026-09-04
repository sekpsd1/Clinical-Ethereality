const promptPayQrPngDataUrl = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function getPromptPayQrDownloadUrl(qrDataUrl: string | null): string | null {
  return qrDataUrl && promptPayQrPngDataUrl.test(qrDataUrl) ? qrDataUrl : null;
}
