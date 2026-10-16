# Customer Doctor professional name, local follow-up 2026-10-17

## Evidence and scope

Owner indicated the Admin-approved Doctor form's `ชื่อ-นามสกุลจริง`. Existing `AdminDoctorProfileForm` submits `fullName`; `manageDoctorProfileSchema` trims/requires2..191 characters, and `doctor-profile-service.ts` persists only `User.fullName` when changed. It does not rename LINE `displayName`. No schema/new professional-name field or provenance attestation invented. This change reads that existing owner-selected field on the same approved/active Doctor records already displayed.

Before this change, both `doctor-list/queries.ts` and `booking/queries.ts` selected only avatarUrl/displayName for user presentation and used LINE displayName for Doctor name. There is no separate Doctor detail route here: `/consult/booking/somchai?doctorId=...` renders `DoctorBooking`/`DoctorBioCard`, using the booking query's name for heading/avatar alt. This task changes those two current discovery/booking paths only.

Fallback: trimmed nonempty `User.fullName`, then trimmed nonempty legacy `User.displayName`, then existing neutral `แพทย์ผู้ให้คำปรึกษา`. No prefix (นพ./พญ.) or credential is automatically appended; any prefix in the fullName is the persisted value. Missing fullName can still show a LINE alias by this explicit legacy fallback. Existing no-record static demo Doctor fallback remains unchanged, not a newly invented name. Shared helper is scoped to Customer Doctor discovery/booking, not generic User or payer naming.

Unchanged/out of scope name paths identified during inspection: Customer payment and appointment header queries, waiting-room/chat/live presentation, advice-log/history and prescriptions, Zoom handoff, Doctor profile/session and all audit/clinical historical records. No global name refactor, Patient identity or receipt payer-name modification. Fees/specialty/avatar/IDs/authentication/ownership, recommendation mapping and slot/scheduling logic remain unchanged.

## Verification

Tests exercise fullName priority when alias differs, whitespace trimming, absent/blank professional name, LINE and neutral fallbacks, exact approved/active query predicates and selected fields, Doctor IDs/prices/avatar/booking paths, query-to-list rendered name and query-to-real DoctorBooking header (form child stubbed to avoid any booking action). Active assessment recommendation/topic/specialty and booking identity preserved. Existing Admin save/action, slot generation, consent and receipt eligibility/payer tests run with mocks only; no real data, Admin save, booking or payment executed.

Local preview runner outside repo uses the actual doctor-list query, real list/AppShell/shared FooterNav and current tokens with a synthetic Prisma adapter. Before query source is read from `afcb71e` via read-only git show; after uses current source. Synthetic User has differing fullName/LINE alias;390x844 before/after screenshots show the preference change. Same Doctor ID/card count/fee/booking href/footer and no horizontal overflow. Image alt follows professional name. Only local fixture image requests fulfilled; all other network blocked. Preview browser closed automatically.

Artifacts in task visualization directory:

- `consult-doctor-name-before-390.png`, `consult-doctor-name-after-390.png`
- `consult-doctor-name-before.json`, `consult-doctor-name-after.json` (synthetic metrics only)
- `consult-doctor-name-preview.cjs`

Local build passed68 pages; lint and TypeScript passed. Final targeted count/diff check and exact hash in Standard Handoff. No owning-Customer/real LINE-device UAT, Production push/deploy, migration, database/provider/environment operation. Current configured model retained, no change claimed.

Final verification:77 tests across7 targeted files passed, including assessment recommendation preservation and unchanged receipt payer/eligibility regression. Final lint, TypeScript and diff checks passed; build result applies to the same unchanged product tree. No checks skipped.

## Standard Handoff

TASK: Customer Doctor professional name on discovery and booking header
STATUS: complete
IMPLEMENTATION: verified
RELEASE: not-requested
UAT: partial
BRANCH: codex/consult-professional-doctor-name
COMMIT: scoped name-display commit containing this handoff; exact hash in final response
CHANGED: doctor-display-name.ts helper, doctor-list/booking queries selecting existing User.fullName, scoped query/UI/fallback tests, PROJECT_STATE and this runbook
CHECKS: Local build68 pages, lint, TypeScript, targeted query/UI/Admin-save/booking/consent/receipt regression and diff check; actual-query mobile synthetic screenshot verified
APPROVAL SCOPE: Controller17 owner-requested local name-display implementation only, no account/LINE/payer identity or business-record mutation
RESIDUAL STATE: Preserve receipt99df95a/e95854c and categoryafcb71e ancestry; no push/deploy; Production remains99df95a; synthetic preview closed/no DB fixtures
NEXT ACTION / OWNER: Controller17 review name-display commit separately from category and receipt; separate release approval if desired
RISKS / FOLLOW-UP: Legacy fallback may still show LINE alias if fullName absent; other historical/payment/clinical name paths deliberately unchanged; real LINE UAT pending; receipt owning-Customer PDF UAT still pending independently
NEEDS PLAN REVIEW: yes
