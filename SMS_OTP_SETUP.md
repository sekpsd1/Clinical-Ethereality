# SMS OTP Setup

## Approved identity boundary

Customer access uses LINE Login plus SMS OTP only. SMS OTP confirms access to the submitted Thai mobile number while the user is signed in to a LINE account. It is not proof of a legal name, national ID, passport, face, or civil identity.

Do not request an ID card, passport, selfie, or patient identity document. Admin does not review patient identity documents in this flow.

## Provider recommendation

Use ThaiBulkSMS OTP Service for the first implementation. It is Thailand-focused, provides a managed request/verify OTP API, API Key/Secret authentication, sender/template management, IP allowlisting, Thai support, and local THB packages. Keep Twilio Verify as a fallback only if delivery or procurement requirements cannot be met.

The owner must provide or arrange, without putting values in git or chat:

1. A ThaiBulkSMS owner account and an OTP application.
2. The OTP App Key and App Secret, configured only as `SMS_OTP_API_KEY` and `SMS_OTP_API_SECRET` environment secrets.
3. An approved sender name and OTP template that contains no health, diagnosis, treatment, prescription, or payment detail and no URL.
4. A five-minute OTP lifetime, six-digit code, and the Production server outbound IP allowlist.
5. Corporate SMS/OTP credits and an agreed monthly budget/alert threshold.
6. Separate credentials/app for Staging and Production.

Set `SMS_OTP_PROVIDER=thaibulksms` and leave secrets empty until the controlled activation is approved. Never log request form data, provider challenge tokens, PINs, full phone numbers, API keys, or API secrets.

## Cost planning

ThaiBulkSMS publishes Corporate SMS packages that include ready-to-use OTP. The current public package table starts at THB 1,500 before VAT and its effective per-credit rate varies by package and promotion. Confirm the current quote, expiry period, sender-name allowance, VAT, delivery-credit policy, and expected OTP volume with the provider before purchase.

Twilio Verify is an international fallback. Its public base price is USD 0.05 per successful verification plus channel fees; Thailand outbound SMS pricing and sender registration requirements are separate and may change.

## Local foundation and activation gate

The local adapter normalizes Thai mobile numbers, masks phone labels, validates provider responses, uses a bounded timeout, and fails closed. Unit tests use a mocked HTTP client and do not send SMS.

Do not expose request/verify routes yet. Safe activation requires a separately approved additive migration and persistent challenge/rate-limit design, including:

- `User.phoneVerifiedAt` and a normalized-phone uniqueness decision.
- A user-owned OTP challenge/attempt record with expiry, resend cooldown, attempt limit, terminal status, and audit metadata.
- Protection for the provider challenge token at rest.
- Per-user, per-phone, and per-IP abuse limits; generic client errors; no OTP/PIN logging.
- Booking and pre-Zoom gates that check LINE session plus verified phone, without claiming document identity verification.
- Controlled Staging/UAT approval before any Production SMS.

PromptPay remains separate: configure the owner-provided recipient only through `THAI_QR_PROMPTPAY_ID`. QR payloads are generated at runtime for the exact amount; do not add a static recipient QR or the real recipient value to source, logs, screenshots, reports, or chat.
