/* eslint-disable @typescript-eslint/no-require-imports */

const TEST_APP_URL = "https://test-app.bccgroup-thailand.com";

function httpCategory(status) {
  if (!Number.isInteger(status) || status < 100 || status > 599) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function getZoomTestZakReadiness({ environment = process.env, fetchImpl = fetch } = {}) {
  if (
    environment.NODE_ENV !== "production" ||
    environment.CE_DEPLOYMENT_ENVIRONMENT !== "test" ||
    environment.NEXT_PUBLIC_APP_URL !== TEST_APP_URL
  ) {
    return { status: "blocked", stage: "environment", httpCategory: "none" };
  }

  const accountId = environment.ZOOM_ACCOUNT_ID;
  const clientId = environment.ZOOM_CLIENT_ID;
  const clientSecret = environment.ZOOM_CLIENT_SECRET;
  const hostUserId = environment.ZOOM_HOST_USER_ID;

  if (![accountId, clientId, clientSecret, hostUserId].every(hasValue)) {
    return { status: "blocked", stage: "configuration", httpCategory: "none" };
  }

  try {
    const tokenUrl = new URL("https://zoom.us/oauth/token");
    tokenUrl.searchParams.set("grant_type", "account_credentials");
    tokenUrl.searchParams.set("account_id", accountId);
    const tokenResponse = await fetchImpl(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      signal: AbortSignal.timeout(15_000)
    });

    if (!tokenResponse.ok) {
      return { status: "not_ready", stage: "oauth", httpCategory: httpCategory(tokenResponse.status) };
    }

    const tokenBody = await tokenResponse.json();
    if (!hasValue(tokenBody?.access_token)) {
      return { status: "not_ready", stage: "oauth_payload", httpCategory: "2xx" };
    }

    const zakResponse = await fetchImpl(
      `https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/token?type=zak`,
      {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` },
        signal: AbortSignal.timeout(15_000)
      }
    );

    if (!zakResponse.ok) {
      return { status: "not_ready", stage: "zak", httpCategory: httpCategory(zakResponse.status) };
    }

    const zakBody = await zakResponse.json();
    return hasValue(zakBody?.token)
      ? { status: "ready", stage: "zak", httpCategory: "2xx" }
      : { status: "not_ready", stage: "zak_payload", httpCategory: "2xx" };
  } catch {
    return { status: "not_ready", stage: "network", httpCategory: "none" };
  }
}

async function main() {
  console.log(JSON.stringify(await getZoomTestZakReadiness()));
}

if (require.main === module) {
  main().catch(() => {
    console.error(JSON.stringify({ status: "not_ready", stage: "unknown", httpCategory: "none" }));
    process.exitCode = 1;
  });
}

module.exports = { getZoomTestZakReadiness, httpCategory };
