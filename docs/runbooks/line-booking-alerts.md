# LINE OA confirmed booking alerts

## Scope and current boundary

Local phase 1 implementation on verified main `fa7c00e`. Disabled by default. No Production changes, credentials read, live LINE calls, database migrations, or paid-plan changes were performed. Controller review and a separate release approval are required before rollout.

Provider sync verification and provider webhook persistence both pass through `applyConsultationPaymentVerification`. Admin provider fallback and manual appointment review pass through `applyConsultationPaymentReviewDecision`. Their successful `scheduled` branches attach a versioned job to the existing doctor in-app notification, atomically with the verified payment and guarded booking transition. Pending intake, rejected slips, provider failures, paid-but-expired/occupied slots and webhook replays do not create jobs. Rescheduling and cancellation alerts are deferred. Notifications created while disabled never acquire jobs later.

The scheduler dispatches after the payment transaction has committed. Transport failures cannot alter payment or booking state. Marker creation requires no new query or network call. It uses the existing notification JSON column, so there is no schema change or migration.

## Recipients and content

Each job snapshots exactly the assigned doctor's User ID and the single configured Admin User ID. Before every recipient's attempt, the dispatcher requires an active user, matching role and valid individual LINE linkage. The Doctor profile must be approved and still assigned to the scheduled, verified-payment consultation. Admin configuration must still match the snapshotted Admin ID. Missing/mismatched recipients fail closed. Matching LINE IDs are deduplicated. There is no broadcast or group recipient path.

The only LINE text is a new confirmed consultation notice, Bangkok start/end dates and times, and a generic role-protected `/doctor/consultations` or `/admin/schedules` link. Both dates appear for midnight crossings. End time uses `bookedDurationMinutes` through the existing duration policy, including its legacy 30-minute fallback. Patient names, consultation IDs, symptoms, payment evidence, credentials and private URLs never enter the outbound message.

## Durable claiming and retry

The existing `Notification.metadataJson.lineBookingAlert` is a small durable job record. MySQL JSON paths select due version-1 jobs, at most two per invocation, bounding four sequential ten-second transport timeouts inside the runner's one-minute deadline. A 60-second lease is acquired with `updateMany` comparing the entire previous JSON value and renewed before each send. Each successful write retains a detached snapshot for the next compare-and-swap. Reading a notification changes only `readAt` and cannot claim, cancel or delete the job. A sustained backlog above two new confirmed appointments per minute requires an explicitly reviewed throughput change.

Before each network call, the recipient's UUID retry key, individual LINE ID and exact text are persisted. A timeout or worker restart reuses all three. Already accepted recipients stay accepted when another recipient retries. A different LINE linkage, role or Admin configuration stops that recipient instead of rerouting the retry. LINE 409 counts as accepted only with its accepted-request header. Acceptance records API acceptance, not device delivery or reading.

Transient 5xx/network failures back off exponentially from two minutes, capped at one hour, with eight attempts. All work expires before the appointment starts or 23 hours after confirmation, whichever comes first. This bounds recovery inside LINE's 24-hour retry-key lifetime. 4xx, including quota/rate 429, stop automatic sending and raise attention. No automatic quota purchase or paid upgrade exists. LINE describes retry-key lifetime and accepted-request semantics in its official documentation. [LINE retry requests](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)

Permanent or expired jobs retain an attention flag. An eligible configured Admin receives one deduplicated, minimal in-app attention notification. The authenticated job result also includes an aggregate attention count and `ok: false`, causing the runner to exit nonzero. If the Admin itself is missing/ineligible or the in-app nudge cannot be written, the durable flag and scheduler monitor remain the operator signal. Resolve missed alerts operationally after reviewing current appointments. Do not invent a new retry key to replay ambiguous delivery. Attention is retained for review.

Ordinary notification UIs have read actions and no delete action. Existing owner-authorized user/consultation purge tools and flow resets deliberately delete related notifications and therefore their jobs too. They are destructive domain operations, not queue cleanup. The dispatcher excludes missing/cancelled/rescheduled/refunded bookings. Any future automatic notification cleanup must preserve pending/processing jobs until terminal. CAS tests clone DB snapshots and enforce exact predicate matching, but live MySQL JSON concurrency still needs disposable-DB verification before release.

## Configuration and release plan

1. Review the scoped commit and passing mock regressions. Verify the JSON claim/filter queries against a disposable MySQL instance with synthetic records, including overlapping runners and crash-after-send recovery. Docker CLI was installed locally but its Linux daemon was unavailable, so this DB check remains unverified.
2. Name the release worker, approve the exact commit and normal Plesk backup/build/rollback plan. Install with `ENABLE_LINE_BOOKING_ALERTS=false` first. No migration is needed.
3. Provision the OA Messaging API access token privately as `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`. Follow the previously identified rotation concern through the approved secret process. Never paste credentials in chat or repository. Confirm the OA and LINE Login remain under the verified same Provider. Confirm each intended recipient can receive OA push messages. Configure exactly one active Admin's internal ID in `LINE_BOOKING_ALERT_ADMIN_USER_ID`.
4. Set a dedicated random `LINE_BOOKING_ALERT_JOB_SECRET` of at least 32 characters and the HTTPS canonical `NEXT_PUBLIC_APP_URL`. Token and job secret are separate. The job accepts POST `/api/jobs/line-booking-alerts` only with its matching `x-clinical-job-secret` header and returns aggregates only.
5. Configure a Plesk task once per minute to run `npm run job:line-booking-alerts` with its private environment containing `NEXT_PUBLIC_APP_URL` and `LINE_BOOKING_ALERT_JOB_SECRET`. Follow the existing scheduled-runner pattern. Enable its failure notifications and monitor successful invocation age. The application process additionally needs the token, Admin ID and feature flag. Activation, scheduler configuration and live sending require separate approval.
6. Enable `ENABLE_LINE_BOOKING_ALERTS=true` only for the approved recipient test. Create a new synthetic consultation through the normal confirmed-payment path. Check exactly two intended push requests, minimal Bangkok content, protected links, durable acceptance, mock retry tests and notification-read independence. Reconfirm disabled behavior. Do not backfill old consultations.
7. Stay within the existing free-tier quota. Monitor scheduler failure/attention counts, credential errors and quota errors. Blocking the OA or other platform restrictions may prevent delivery even after API acceptance.

Roll back by disabling the flag and scheduler, then reverting the scoped release through the normal Plesk build/restart procedure if needed. Retain durable metadata for investigation. Re-enabling does not backfill unmarked bookings. Existing unaccepted marked work may resume only inside its original deadline; accepted keys stay accepted.

## Local validation

Unit tests use only synthetic users, dates, keys and mocked transport/Prisma. Relevant suites cover both shared payment hooks, all payment channel guards, dispatcher authorization/claims/retries, transport status semantics, job authorization and existing notification-read behavior. Lint, TypeScript and Next build are required. Live MySQL, OA delivery and Plesk scheduler acceptance are separate release checks.
