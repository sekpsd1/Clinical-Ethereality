# Consultation receipt: implementation gate

Superseded gate status: Controller17 subsequently approved all five choices, including confirmation-date/account-name wording and the non-statutory reference. Current configured model retained, introspection unavailable and not blocking. Implementation and QA outcome: see `consultation-receipt-local-handoff.md`. The evidence/proposal below is retained as dated design history, not an active approval blocker.

## Evidence and authority

Controller17 assigned Admin7 local implementation on 2026-10-16, with explicit review before a new dependency, additive schema or legal/numbering decision. Live thread inventory confirms both identities; TASK_CONTROL is corrected only for these two roles. Actual model setting is not exposed by available tools and remains unverified; no model change claimed.

Remote main read-only check: `8e0b4c0fa4beb9cafe79de986dc6df4b90d5b2c1`. Dedicated branch `codex/consultation-receipt-pdf` preserves local closeout `02ff215`; no reset/cherry-pick/push. Do not implicitly publish that closeout.

`Payment` currently stores amount (Decimal 10,2), method (promptpay only), status, reviewedAt, refund metadata, and a unique consultationId. It does not store receipt number, currency, immutable payer identity or a dedicated receivedAt. Provider verification service and Admin manual review set reviewedAt during confirmation. Provider webhooks can have no transaction timestamp. Existing Customer payment/appointment queries scope consultation by patientId; some display labels derive from lifecycle and must NOT be reused for receipt eligibility. The actual Payment.status must independently equal verified.

## Decisions requested before authoring

1. Approve a Node-only PDFKit runtime dependency plus development TypeScript definitions, exact resolved versions/lockfile checked before commit. Bundle an openly licensed Thai font (proposed Noto Sans Thai regular/bold plus OFL license) locally; no runtime font/network fetch and no browser PDF engine on Plesk. Official PDFKit documentation supports embedded fonts and measured wrapped text: https://pdfkit.org/docs/text.html. Thai shaping, mark placement and line wrapping still require actual rendered verification, not an assumed guarantee. No application Python runtime dependency is proposed; bundled PDF tools are QA-only.
2. Approve receipt reference `CP-<complete Payment.id>` as a stable internal payment-receipt reference, explicitly not a sequential statutory/tax-invoice number. No truncation/collision-prone number, download counter, tax ID or signature. Repeated downloads keep that reference without any database write. If a statutory sequence or immutable issued-document snapshot is required, stop for separate schema/legal design instead.
3. Decide date semantics: recommended label is `วันที่ยืนยันรับชำระเงิน` using valid Payment.reviewedAt in Asia/Bangkok, NOT a claimed bank transfer timestamp. Do not use createdAt/updatedAt/download time as substitutes. If the document must say actual received/transfer date, records without a separately proven authoritative transaction timestamp must be ineligible; do not infer it from reviewedAt. No schema change proposed at this stage.
4. Approve accurate payer label `ชื่อผู้ชำระตามบัญชีผู้ใช้` using the current owned Customer displayName, not a verified legal-name claim or bank sender identity. No fallback invented name. This is not an immutable historical identity snapshot: a profile rename could change text on a later download while reference stays stable. If exact historical identity/content is required, propose immutable issuance metadata under separate schema approval.
5. THB is the application's current PromptPay consultation business rule, not a persisted Payment currency. Approve explicitly limiting this receipt to the existing THB channel; no currency guessing for future methods. Amount must come from Payment.amount, never current Doctor fee or provider raw JSON. Any unsupported method, malformed/nonpositive amount, missing payer/confirmation date or inconsistent relation fails closed.

## Proposed bounded implementation after approval

- Issuer exactly: บางกอกไซโตเจเนติกส์คลินิก เฉพาะทางด้านเวชกรรมสูตินรีเวช
- Address exactly: 65/18 ซอยโชคชัยร่วมมิตร แขวงจอมพล เขตจตุจักร กรุงเทพมหานคร 10900
- Thin authenticated Node GET route, e.g. `/api/consultations/[consultationId]/receipt`, delegates to a narrowly selected domain query and PDF renderer. Validate identifier; require current active authenticated Customer and owned consultation/payment. Staff, other Customer, no session, missing/ineligible record fail closed. Follow existing revocation/account-status guards, not role claims alone.
- No diagnosis, symptoms, assessment, chat, prescription, Doctor specialty or raw provider payload in the PDF/query/logs. Only issuer/address, reference, labelled date/payer, consultation-fee item, paid amount/currency/channel. Use fixed ASCII attachment filename, application/pdf, private no-store/max-age=0 headers, nosniff and no-referrer on success AND errors. No static/public PDF file or external service.
- Eligibility comes solely from verified Payment plus required authoritative fields, regardless of scheduled/live/completed/cancelled consultation lifecycle. Refunded payments (including contradictory refundedAt/refundAmount/reference on verified rows) are withheld. Pending/rejected/unpaid withheld. Historical verified records with sufficient data eligible; missing legacy fields produce a safe unavailable state, no backfill. Eligibility helper shared by Customer payment and appointment detail links; endpoint independently rechecks it.
- Repeated download is read-only: no payment/booking/provider writes, download-generated receipt identity, implicit consent, network font fetch or public storage. No schema/migration required for the above limited design.
- Tests: provider/manual verified fixtures; every nonverified status; refunds/inconsistent metadata; session/active account/ownership; malformed IDs; missing date/name/invalid amount; repeated stable reference; private response headers on all paths; no DB/provider writes. Render synthetic normal and long Thai names/address, decimals/max amount and date boundaries to PDF/PNG; inspect embedded font/text and visual glyphs/no overlap. Run build, lint, TypeScript and targeted tests. No Production records or real payment transactions.
- LINE UAT (pending): owning Customer opens receipt from payment and historical appointment; PDF loads/downloads in LINE iOS/Android and external browser; filename/font/long content correct; repeat reference stable; logged-out/other Customer cannot access copied URL; pending/rejected/refunded show no link; verify no flow transition on download.

## Handoff

TASK: Consultation receipt PDF dependency/date/identity gate
STATUS: blocked
IMPLEMENTATION: not-started
RELEASE: not-requested
UAT: not-run
BRANCH: codex/consultation-receipt-pdf
COMMIT: see scoped documentation commit containing this file
CHANGED: Governance identity correction, PROJECT_STATE status and evidence-backed implementation proposal only
CHECKS: Live owner/controller inventory, remote exact baseline, payment schema/provider/manual writers, existing customer query/auth patterns, dependency/font inventory; documentation diff/consistency check. Build/lint/TypeScript/security tests not run because no implementation exists.
APPROVAL SCOPE: Local implementation authorized; explicit new dependency/legal-numbering design gate not yet cleared. No push/deploy/migration/data mutation authorized.
RESIDUAL STATE: 02ff215 preserved locally; no PDF, package install, product edit, schema or external mutation
NEXT ACTION / OWNER: Controller17 approve/revise five concrete decisions above and confirm actual available model setting before financial/privacy implementation
RISKS / FOLLOW-UP: Receipt reference not statutory numbering; current account name not historical legal identity; confirmation timestamp not bank timestamp; actual Thai/LINE PDF verification pending
NEEDS PLAN REVIEW: yes
