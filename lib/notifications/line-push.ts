export type LinePushOutcome = "accepted" | "retry" | "failed";

export async function pushLineBookingAlert(input: {
  token: string;
  lineUserId: string;
  retryKey: string;
  text: string;
}): Promise<LinePushOutcome> {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": input.retryKey
      },
      body: JSON.stringify({ to: input.lineUserId, messages: [{ type: "text", text: input.text }] }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error"
    });
    // Never persist or log provider response bodies. A 409 is accepted only
    // when LINE confirms that this retry key was previously accepted.
    if (response.ok || response.status === 409 && response.headers.has("x-line-accepted-request-id")) return "accepted";
    if (response.status >= 500) return "retry";
    // Quota/rate/auth errors need operator attention, not an automatic paid upgrade.
    return "failed";
  } catch {
    return "retry";
  }
}
