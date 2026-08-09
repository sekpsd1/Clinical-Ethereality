# Zoom Production Setup

This is an owner-run Production setup guide. It does not authorize deployment, production database changes, payment testing, or copying credentials into source control. Keep every value in Plesk environment settings; never place it in `.env.example`, commits, browser storage, screenshots, or support tickets.

## Required Zoom apps

Create two **internal** apps in the same Zoom account:

1. **Meeting SDK app** (Embed > Meeting SDK) for the browser client. Copy its production Client ID and Client Secret only after the app is activated for the owner account.
2. **Server-to-Server OAuth app** for the server's meeting creation, short-lived host ZAK lookup, and webhook subscription. The Zoom account owner/admin must grant the developer permission to create/edit the app and select its scopes.

The meeting host must be a licensed Zoom user in that account. This implementation deliberately uses one configured host identity. Do not schedule concurrent clinical rooms against a single host user; provision the operational host capacity and update the implementation before enabling overlapping consultations.

## Plesk environment variables

Set these as private Node.js environment variables (names only; do not put their values in git):

| Purpose | Variable |
| --- | --- |
| Meeting SDK production Client ID | `ZOOM_MEETING_SDK_CLIENT_ID` |
| Meeting SDK production Client Secret | `ZOOM_MEETING_SDK_CLIENT_SECRET` |
| S2S OAuth Account ID | `ZOOM_ACCOUNT_ID` |
| S2S OAuth Client ID | `ZOOM_CLIENT_ID` |
| S2S OAuth Client Secret | `ZOOM_CLIENT_SECRET` |
| Licensed Zoom user ID or email used as the clinical meeting host | `ZOOM_HOST_USER_ID` |
| S2S app Feature > Event Subscription secret token | `ZOOM_WEBHOOK_SECRET` |

Only server code reads all of these variables. The browser receives a per-room Meeting SDK JWT, meeting number/passcode, and (for an authorized doctor/admin host only) a just-in-time ZAK. It never receives a client secret, S2S OAuth token, account ID, or webhook secret. The SDK JWT expires after 30 minutes, Zoom's documented minimum duration.

## S2S scopes and events

Grant only these baseline granular/classic equivalent scopes in the Server-to-Server OAuth app:

- `meeting:write:admin` — create the scheduled meeting for `ZOOM_HOST_USER_ID`.
- `user:read:admin` — retrieve that Zoom user's short-lived ZAK immediately before an authorized doctor/admin starts the embedded meeting.

Enable Event Subscription in that same S2S app:

- Endpoint URL: `https://app.bccgroup-thailand.com/api/webhooks/zoom`
- Events: `meeting.started`, `meeting.ended`
- Use the generated **Secret Token** as `ZOOM_WEBHOOK_SECRET`; do not use the deprecated verification token.

Zoom validates a webhook URL at setup and periodically. The endpoint verifies `x-zm-request-timestamp` (five-minute window) and `x-zm-signature` before JSON parsing/database work; lifecycle audit records make retries idempotent and the raw body is never saved.

## Domains, origins, and network configuration

- Use only the HTTPS production hostname: `https://app.bccgroup-thailand.com`. Never configure a raw IP address as a Meeting SDK web domain.
- The webhook endpoint must remain HTTPS and publicly reachable at the exact path above; do not add HTTP-to-HTTPS redirects on that route.
- A pure Meeting SDK embed does not use OAuth redirect URLs. If the owner adds a Zoom App Surface or OAuth feature later, add only the exact production origin/redirect URL to that app's Domain Allow List and OAuth allow list; do not add wildcards or staging/development origins to the production app.
- Keep the app behind the existing HTTPS hostname and ensure Plesk/WAF permits inbound Zoom HTTPS POST requests to `/api/webhooks/zoom`. Do not allow browser cross-origin credential access; the Meeting SDK package loads in the app's same origin.
- If Plesk or the application enables a Content Security Policy, include Zoom's documented Meeting SDK browser sources before UAT: `script-src` needs `https://zoom.us`, `*.zoom.us`, `dmogdx0jrul3u.cloudfront.net`, `blob:`, and the documented `unsafe-inline`/`unsafe-eval` allowances; `connect-src` needs `https://zoom.us`, `https://*.zoom.us`, and `wss://*.zoom.us`; `worker-src blob:` is also required. Keep every other directive as restrictive as the existing application allows.
- Version check performed locally: `@zoom/meetingsdk` is 6.2.0, which Zoom listed in its Web changelog on 22 June 2026. Recheck Zoom's quarterly minimum-version policy immediately before deployment/UAT.

## Plesk procedure

1. In Zoom Marketplace, activate the two apps, copy production (not development) credentials, choose the scopes/events above, and complete the webhook challenge at the final HTTPS URL.
2. In Plesk, open the Node.js application's environment-variable settings. Enter each variable above as a private value. Do not add them to the repository or Plesk Git deployment settings shown to other users.
3. Confirm `NEXT_PUBLIC_APP_URL` is exactly `https://app.bccgroup-thailand.com`, save, then restart the Node application. Do not run Prisma migrations or any payment migration. The current lockfile resolves React 19 while Meeting SDK 6.2.0 declares a React 18 peer, so strict `npm install` fails locally; the verified build uses the project's locked dependency installation with `npm ci --legacy-peer-deps`. Confirm Plesk's existing install process is equally deterministic before the credential window, rather than running an ad-hoc dependency upgrade.
4. Visit the existing authenticated admin integration-readiness screen to confirm presence only. It must not display values. Confirm an unauthenticated request cannot reach a consultation room.
5. Complete the non-monetary UAT below. Do not use real charges, real patient data, or record a consultation for this readiness check.

## Non-monetary Production UAT

Use designated test Doctor/Admin and Customer accounts and a pre-authorized scheduled test consultation produced through the approved non-monetary workflow.

1. At 390 x 844, verify the customer waiting room and live room contain no horizontal scrolling and no Console/Server Error.
2. Have only the assigned Doctor start the room. Verify Zoom meeting creation occurs once, the doctor enters as host, and the customer enters only that customer's consultation as participant. Attempt the URL with another customer and a pharmacist; both must be blocked.
3. Verify the customer waits until the host starts/adopts the room; do not enable join-before-host. Verify live consultation hides `FooterNav`.
4. Confirm `meeting.started` and `meeting.ended` are accepted once, retries do not duplicate audit/notification records, invalid or stale signatures return no sensitive details, and no raw webhook payload is saved.
5. Temporarily remove one required Zoom variable in a controlled test window, restart the Node app, and verify the Zoom page states that setup is incomplete without a Console/Server Error or secret value. Restore the variable and restart.
6. Review Plesk/Node logs for normal status/error categories only; OAuth access tokens, client secrets, ZAKs, passcodes, and webhook bodies must not appear.

## Disable / rollback

To disable Zoom without changing data, remove or blank all seven `ZOOM_*` variables above in Plesk and restart the Node app. New meetings will not be created and the live room presents its explicit unavailable state. Do not delete consultation, payment, audit, or webhook history as part of rollback. Deactivate the S2S app's Event Subscription and then the Meeting SDK app in Zoom Marketplace if an incident requires a hard stop; rotate the affected secret(s) first if exposure is suspected.

## Official Zoom references checked

- [Meeting SDK overview](https://developers.zoom.us/docs/meeting-sdk/)
- [Meeting SDK authorization and JWT/ZAK requirements](https://developers.zoom.us/docs/meeting-sdk/auth/)
- [Meeting SDK security practices](https://developers.zoom.us/docs/meeting-sdk/security-practices/)
- [Server-to-Server OAuth account credentials](https://developers.zoom.us/docs/rooms/s2s-oauth/)
- [Create a Server-to-Server OAuth app](https://developers.zoom.us/docs/internal-apps/create/)
- [Zoom API authentication](https://developers.zoom.us/docs/api/authentication/)
- [Webhook validation and verification change](https://developers.zoom.us/changelog/platform/webhook-url-validation/)
- [Browser support and CSP requirements](https://developers.zoom.us/docs/meeting-sdk/web/browser-support/)
- [Web Meeting SDK changelog](https://developers.zoom.us/changelog/meeting-sdk/web/)
- [SDK minimum-version policy](https://developers.zoom.us/docs/build/minimum-version/)
