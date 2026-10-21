# Doctor service categories and fallback audit — local only, 2026-10-21

## Ownership and baseline

Controller17 assigned existing Admin7 one bounded cross-surface consistency fix. Doctor ระบบ 6
(`01a09f7f-4003-7582-9a53-4fe2aad3b754`) was read-only verified notLoaded, latest turn completed;
no active writer conflict was found. Current configured model retained; actual model introspection
unavailable. One read-only subagent audited other surfaces, main alone edited product files.
Remote `git ls-remote origin refs/heads/main` succeeded and returned exact
`1a5e31a3f4ab92855d5c7461d830b2c9a294dd36`; local parent `d61f12a` adds release docs only.
No claim of fresh Production UI inspection: this is local source investigation/implementation only.

## Cause and bounded changes

At deployed-record source1a5e31a, `features/doctor/DoctorConsultations.tsx:22` independently declared
`["สูตินารีแพทย์", "HPV/STIs", "ปรึกษาทั่วไป"]`. Its render was unconditional and never read Admin
category configuration. Customer removal had changed a different array. Empty Admin data therefore
could not suppress Doctor chips; it was not stale database content or a failed Admin save.

Both surfaces now import owner-approved `CONSULT_SERVICE_LABELS` containing only `สูตินรีแพทย์`.
This remains an explicit static navigation policy, NOT a fabricated claim of Admin-configurable
categories. No service/schema abstraction or data filtering added. Queue status filters, ordering,
counts, permissions, prescription/identity gates and Doctor records unchanged.

Customer discovery no longer constructs a demo Doctor when approved records are empty or a query
fails. Empty and unavailable copy are distinct; neither contains a synthetic bookable card.
Booking no longer renders a fabricated Doctor biography when doctor=null. Actual Doctor specialties
and records are preserved; missing specialty in the bio uses neutral text rather than a clinical claim.

## Evidence audit

Line references below describe audited source1a5e31a (before this local patch), unless marked current.
Admin professional source is `Doctor.specialty`/`Doctor.bio`/`licenseNumber` saved by
`features/admin/users/doctor-profile-service.ts`, via Admin users form; schedules/fee are separate.

| Route / component | Static vs database / Admin source | When absent | Action |
|---|---|---|---|
| `/doctor/consultations`, `DoctorConsultations.tsx:22,171` | Independent hardcoded three-service array, not Admin data | Rendered all chips even with empty queue/missing profile | Fixed shared one-label policy; no queue filtering change |
| `/consult`, `ConsultDoctorList.tsx:6,35` | Static customer one-label strip, independent of Doctor records | Still shows approved navigation label | Reused shared constant; actual DB specialties remain untouched |
| `/consult`, `doctor-list/queries.ts:15–30,119–132` | Approved active Doctor records plus synthetic Kamonpat/MFM/800 fallback | Zero records OR DB error returned a bookable demo | Fixed empty array, distinct empty/error UI; no synthetic Doctor |
| Customer real Doctor card `doctor-list/queries.ts:69` | DB Doctor.specialty, Admin users | Neutral ปรึกษาออนไลน์ | Preserved; do not filter/remove actual Doctor by specialty text |
| `/consult/doctors/[doctorId]`, `doctor-profile/queries.ts:7–14`, `DoctorProfile.tsx:24–35` | Approved active Doctor, Admin bio/license/specialty/current fee | Missing Doctor404; bio/license/fee explicit unknown; specialty neutral | No unsupported category found; preserve |
| `/consult/booking/somchai`, `booking/queries.ts:178–186,268`, `DoctorBooking.tsx:53,78` | Approved active Doctor, Admin schedules/fee; null data fell through component demo | Fabricated Kamonpat and gynecology bio for null Doctor | Fixed no bio card for null Doctor; existing booking form unavailable flow unchanged |
| `/consult/payment`, `payment/queries.ts:121–122` | Related actual consultation Doctor | Null specialty invented เวชศาสตร์ชะลอวัย; null name invented Somchai | Reported, deferred: record/payment presentation distinct from service chips; requires bounded follow-up, no financial/history changes here |
| `/consult/appointments/[id]`, `appointment/queries.ts:202–203` | Related actual consultation Doctor | Same invented anti-aging specialty/Somchai name | Reported/deferred with payment fallback; no historic record edits |
| `/consult/waiting-room`, `waiting-room/queries.ts:107` | Authorized actual consultation Doctor | Neutral name; missing consultation=null | No extra category/fabricated service; preserved |
| `/consult/live`, `chat/queries.ts:18,54,144`, `LiveConsultation.tsx:34` | Authorized actual consultation / DB Doctor | Neutral name; absent consultation404 | No extra categories; preserved |
| `/doctor/profile`, `app/doctor/profile/page.tsx:9–12`, `features/doctor/DoctorProfile.tsx` | Session name/avatar, not Admin professional bio | Neutral name | No category chips; preserved; do not confuse with customer bio page |
| `/doctor/patients`, `patients/queries.ts:87–126`, `DoctorPatients.tsx:86–96` | Doctor-scoped patient/consultation data | Missing profile/error→empty and explicit state | No fabricated service/patients; preserved |
| `/admin/users`, `AdminDoctorProfileForm.tsx:61`, `users/queries.ts:285`, service:167,174 | Actual Doctor.specialty via Admin form, required validation | Empty input, validation on save | Not a category-catalog configuration; no change |
| `/admin/schedules`, `schedules/queries.ts:131,146`, schedule/fee editors | Actual Doctor.specialty/fee/schedules | ยังไม่ระบุสาขา | Neutral and honest; no change |
| Admin customer consultation, `customers/queries.ts:206` | Related actual Doctor.specialty | ปรึกษาออนไลน์ | Neutral; no change |
| Staff invitation/approval | Existing LINE linkage plus Admin professional fields | Pending/required fields rather than service chips | No additional hardcoded HPV/STIs/general category arrays found |

## Separate follow-ups (not modified)

- Static ratings: every actual list Doctor4.9; booking4.9/120+ reviews, no review-backed query.
- Default photographs: `DoctorAvatar.tsx:5`, list/booking use another Doctor portrait; payment uses Somchai image.
- Missing fees: list0, booking query1000, booking form800 when Doctor absent, payment1000; profile says unspecified.
  Requires bounded financial-presentation review, not a silent price change in this category fix.
- Payment/appointment invented names/anti-aging specialty above: recommend neutral missing-value copy,
  preserve stored values and permissions; no global name/history refactor authorized here.
- Owner-authorized simulated biographies previously saved in Admin are DB content, not these static chips.
  No live DB inspection/change in this task. Actual credentials must be verified before real service use.
- Clinical assessment recommendations/questions, legitimate HPV Store catalog text, and historical stored
  specialty/clinical content are not service-navigation bugs and were deliberately not replaced.

## Verification and boundary

Targeted46 tests/7 files passed, including three status filters and their selected/default states,
ordering/count/privacy/identity/auto-refresh regressions, profile guards and empty/error discovery.
Actual DoctorConsultations SSR previews at320/390px before/after use synthetic empty data only;
network blocked and child mutation components stubbed (not claimed browser-interaction UAT).
Both widths have no horizontal overflow; category list changed from three to only correct label;
all three accessible status-filter labels/pressed states and queue text are semantically identical.
Screenshots/JSON/runner are outside repo in task visualization directory, `doctor-category-*`.
Main visually inspected390px after screenshot. No Production access, data mutation, push, deploy,
migration, restart, payment/provider action or repeated cleanup. `npm run lint`, `npm run typecheck`
and `npm run build` passed;68/68 static pages generated. `git diff --check` passed. Documentation-only
completion after those checks does not change the verified product source.
