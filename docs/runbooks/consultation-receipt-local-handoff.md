# Consultation payment receipt PDF: local handoff

## Presentation follow-up (2026-10-16)

After implementation `9c15dd7`, the owner requested a more polished format. Renderer-only styling adds the existing English clinic brand above the Thai title, a restrained teal rule, separately labelled two-column reference/confirmation date, payer block, aligned fee table and soft-teal total strip. Disclaimer remains clearly separated at the bottom. No logo, seal, signature or tax/legal data was invented. All issuer/address/payment/reference/date/current-name values and eligibility/auth/download behavior remain unchanged. Fonts/dependencies/tracing/schema are unchanged.

Normal synthetic 1,000.00 THB and long/max-value stress examples were rendered and visually inspected. Both are one A4 page with four embedded FontFile2 fonts and no clipped/overlapping text; independent character bounds checks passed (564 normal and 841 stress characters). Added a normal-render fixture; receipt model/API/UI/PDF tests passed 41/41 across three files. Lint and TypeScript passed; the affected local build is reported in the final handoff. New normal PDF and preview are in visualization `output/pdf/receipt-restyled/consultation-receipt-preview.pdf` and `receipt-normal-final-1.png`; stress output is QA-only. No Production access/write, push, deploy, restart or data mutation. Actual LINE/device UAT remains pending.

## Contract and boundaries

Controller17 cleared the five choices in `consultation-receipt-design-gate.md` and authorized local implementation only. This receipt is not a tax invoice or an immutable issued-original snapshot. Identity is `CP-<full Payment.id>`, labelled `เลขอ้างอิงใบเสร็จ`. Repeated downloads retain the same reference, but display the current account name and current authoritative payment record. No sequential/statutory numbering, tax ID, signature, legal-name claim, fabricated transfer timestamp or guessed historical identity.

Issuer/address are the exact owner-supplied Thai strings. `วันที่ยืนยันรับชำระเงิน` comes solely from valid nonfuture `Payment.reviewedAt`, formatted Asia/Bangkok. This is confirmation time, not bank transfer time. `ชื่อผู้ชำระตามบัญชีผู้ใช้` is the current owned active Customer displayName. Amount is actual Payment Decimal(10,2), not current Doctor fee; PromptPay THB is the explicitly approved existing channel/currency business rule (there is no persisted currency column). No schema/migration/backfill. Missing legacy values, unsupported fonts/name glyphs, unsupported method, inconsistent Store link or any refund metadata fail closed.

Eligibility is exact Payment.status verified, independently of consultation lifecycle. Verified manual and provider paths qualify equally; no reviewer's identity or raw provider payload is needed. Pending_slip/pending_review/rejected/refunded never qualify. Any nonnull refund field (even zero/empty contradictory values on a verified row) withholds the receipt. Historical verified payments qualify if the required fields exist. Unsupported emoji/CJK account names withhold instead of substituting squares; no automatic rename/sanitization/fake name.

## Implementation map

- `features/consultations/receipt/model.ts` and `font-coverage.ts`: shared pure eligibility/data contract/date and known glyph coverage.
- `receipt/queries.ts`: current active Customer and exact active/unrevoked/unexpired AuthSession binding, plus owned Consultation Payment selection. No clinical/raw provider fields and no writes. Legacy access JWT lacking sessionId must reauthenticate; no session-bypass fallback.
- `lib/auth/session.ts`: retain the existing verified JWT sessionId when converting claims to PublicSession (the type already supports it); no token issuance, role, refresh or cookie behavior change. Necessary for exact revocation checks, covered by a regression test.
- `receipt/pdf.ts`: in-memory PDFKit 0.20.2 with embedded local Thai/Latin regular/bold fonts. Measured word/grapheme layout handles long references without clipping and keeps Thai marks together; generic PDF metadata only.
- `app/api/consultations/[consultationId]/receipt/route.ts`: validated thin authenticated GET; 401/403/404/503 generic failures and success all private/no-store/max-age=0, Vary Cookie, nosniff/no-referrer/noindex. Success attachment filename fixed ASCII. No public PDF/storage or external renderer.
- `ReceiptDownload.tsx`: native download anchor, no prefetch/form mutation, reused in existing customer payment and appointment detail. Both existing query mappers use the same eligibility path; existing tokens/footer/booking/payment/slip flows remain unchanged.
- Exact PDFKit 0.20.2 and dev types 0.17.6 with lockfile. Four unmodified static Noto font files from the pinned official source plus OFL/provenance/SHA-256 in `assets/fonts/receipt/README.md`. Thai files lack Latin, so companion NotoSans handles references/mixed names. No runtime font fetch. Next standalone explicitly traces assets.

## QA and release boundary

Only synthetic fixtures; no Production patient/payment/consent record accessed or changed. No push, deploy, restart, schema/migration, environment/provider/Zoom/Drive/LINE-console/scheduler change. Preserved ancestry `8e0b4c0` (remote/Production baseline), local closeout `02ff215`, design gate `4c43792`; do not implicitly publish ancestors. Current configured model unchanged; actual model name/effort unavailable to tools.

Targeted receipt/auth/payment regression: 133 tests across 12 files passed at initial final verification. PDF stress fixture covers a maximum-length reference, 255-character mixed Thai/Latin payer, full address, maximum Decimal amount 99,999,999.99 THB, Bangkok date boundary, Thai combining marks and four embedded fonts. Initial continued-font-run wrapping overflowed the long reference; replaced with explicit measured word/grapheme lines and rerendered. Final Poppler preview visibly contains correct Thai glyphs/marks with no clipping/overlap. Independent pdfplumber/pypdf check: one A4 page, four embedded FontFile2 fonts, 798 characters within margins, x range 48.00-547.16pt, correct extracted amount/channel/reference. Text extraction alone was not used to accept Thai layout.

Final build/lint/TypeScript, standalone font trace and any later review adjustments are reported in the final Standard Handoff; no claim of production/device UAT. Synthetic PDF and PNG preview live outside the repository in this task's visualization `output/pdf` directory, not public app storage.

Final verification completed: 135 tests across 12 targeted files, lint, TypeScript, diff check and local build (68 pages) passed. Standalone explicitly externalizes PDFKit and includes four unique custom font files/OFL plus all 14 standard-font CJS modules and their helper chunks/license. A direct ESM import from the actual standalone copy successfully constructed and rendered a Thai PDF. This check initially found missing dynamically required standard-font modules despite a passing build; tracing was corrected and the final runtime check passed. Path verification normalizes/deduplicates Windows slash variants in Next traces. Final compiled local server unauthenticated HTTP request returned 401 with private no-store/nosniff and generic JSON; the temporary server was stopped. No authenticated real-data request was made.

Independent read-only security review found no blocking issues and checked actual Regular/Bold glyph coverage (NotoSans 2841 entries, NotoSansThai 102; only noncharacter U+FFFF lacks Bold coverage and is already excluded). Production-dependency npm audit reported 25 existing advisory entries (1 critical, 10 high, 13 moderate, 1 low); comparing added lockfile package names found none of the newly added PDF dependency packages in the advisory keys. No unrelated dependency remediation attempted; Controller should route the baseline security backlog separately before authorizing a release. Actual LINE iOS/Android download/open and authenticated end-to-end UAT remain pending.

## Standard Handoff

TASK: Verified-only consultation payment receipt PDF
STATUS: complete
IMPLEMENTATION: verified
RELEASE: not-requested
UAT: not-run
BRANCH: codex/consultation-receipt-pdf
COMMIT: scoped implementation commit containing this file; exact hash in final response
CHANGED: Receipt eligibility/query/PDF/private GET/shared download UI; Customer payment and appointment integration; sessionId propagation; PDFKit lockfile, OFL font assets/standalone tracing; tests and scoped state/governance/runbooks
CHECKS: 135 targeted tests/12 files, lint, TypeScript, build 68 pages, diff check; synthetic Thai visual/bounds/four embedded fonts; actual standalone rendering and HTTP401 privacy headers; independent security review
APPROVAL SCOPE: Controller17-approved local implementation/design only; no Production release or data mutation
RESIDUAL STATE: Clean committed feature branch expected at handoff; preserve 02ff215/4c43792 ancestry and remote baseline 8e0b4c0; temporary server stopped; synthetic artifact outside repo
NEXT ACTION / OWNER: Controller17 review exact implementation/dependency/auth delta and ancestor scope; owner/Customer QA actual LINE device checklist, then separate release authorization if desired
RISKS / FOLLOW-UP: Current-name/nonimmutable document, confirmation not transfer date, unsupported glyph/legacy records withheld, device UAT pending, existing dependency advisory backlog; model introspection unavailable and settings unchanged
NEEDS PLAN REVIEW: yes

## LINE/customer UAT checklist (pending)

1. On LINE iOS and Android, log in as the owning active Customer; verify eligible verified payment shows receipt on payment page and historical appointment detail. Open/download PDF and confirm filename, Thai marks, reference, actual amount/channel and Bangkok confirmation date.
2. Repeat download: reference unchanged; current-account-name limitation clear. Test long Thai/Latin names, accessibility/large device text and external browser fallback. Mobile platform behavior remains unverified until real devices are used.
3. Pending/rejected/unpaid/refunded and incomplete historical records: no download link; direct URL denied. Completed/scheduled lifecycle alone must not unlock it.
4. Copy URL to logged-out/other Customer/staff: denied. Revoke/expire the exact session or deactivate account: denied even with otherwise valid JWT.
5. Download must not accept consent, change booking/payment status, call a payment provider or create public/static artifacts. Confirm private headers on both success and denial.

Release requires separate owner/Controller authorization and review of exact commit/ancestor scope, host dependency/font tracing and safe deployment checks. No business-data rollback is needed for local code; rollback is a scoped revert if a future release is separately approved.
