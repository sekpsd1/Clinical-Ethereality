# Customer Profile Correction And Thai Address Handoff

Date: 2026-09-15

Branch: `codex/profile-edit-thai-addresses`

Base: `origin/main` at `c5c1dbd8ba73f074f63d291cca13af8587052351`

## Implemented scope

- An authenticated Customer whose database account is still active can edit only the canonical `User.fullName`, `User.dateOfBirth`, and the existing optional email field from `/profile/settings?section=account`.
- The account form does not submit or mutate national ID, phone, normalized phone, or phone-verification state. Phone remains visible as read-only.
- Dates are entered with the native mobile date control, validated as real non-future ISO calendar dates on the server, and displayed in Thai with the Buddhist year.
- A legal-name or DOB correction writes only changed field names to audit metadata. No identity value is written to audit metadata, logs, or URLs.
- Doctor consultation start now requires a new identity reveal when a Customer correction was audited after the prior reveal, both before Zoom creation and in the final Serializable transaction.
- `/profile/shipping-addresses` is the sole address create/edit form in the current project. Store checkout and prescription ordering continue to select saved addresses and create immutable `OrderShippingAddress` snapshots.
- Shipping-address create/edit now uses one reusable Province → District/เขต → Subdistrict/แขวง cascade with postal assistance. Changing a parent clears all dependent values. Bangkok-specific labels are used.
- The Server Action independently validates the full hierarchy and postal code. An unchanged legacy free-text hierarchy remains editable without being blanked; any geography change must resolve to a canonical dataset row.
- Active-Customer and ownership checks are enforced before shipping address mutation or order snapshot lookup.

## Data source and refresh boundary

The implementation pins `@riz007/thai-address-data` version `0.1.4` (MIT, no runtime dependencies). It contains 7,436 normalized rows built from `thailand-geography-data/thailand-geography-json` commit `c76e019fe7a2d51cafd40be8261f59b10310f9d1`.

This is a community-maintained dataset, not a guarantee of current government or Thailand Post authority. The government catalog postcode dataset is public under Open Data Common, but its catalog reports unknown update frequency and does not establish a complete application-ready hierarchy. Before refreshing the pinned package, review upstream source changes and license, compare row/province counts and changed hierarchy/postal mappings, run the hierarchy/legacy/snapshot regression suite, and never rewrite existing `ShippingAddress` or historical `OrderShippingAddress` rows automatically.

## Explicitly unchanged

- No Prisma schema, migration, data backfill, Production mutation, provider call, push, merge, deploy, restart, or global model change.
- No patient-address dataset separate from `ShippingAddress`.
- No national-ID or phone correction path.
- No Consultation, Prescription, or Order identity/address snapshot was added or rewritten. Prescriptions remain user-linked; historical order shipping snapshots remain immutable strings.
- No address deletion behavior was added.

## Verification

- Focused profile, identity-gate, hierarchy, ownership, legacy, checkout-snapshot, and prescription-order suite: 12 files / 68 tests passed.
- Full unit suite: 200 files passed and 3 skipped; 1,328 tests passed and 6 skipped.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build`: passed. The production build completed all 65 routes; the address dataset remains outside the initial shipping-address route bundle through client-side lazy loading.
- `npx prisma validate`: passed with a disposable local placeholder connection string and the repository's local schema engine.
- Prisma schema-to-schema diff: passed with `No difference detected` (there is no schema or migration change).
- `npm audit --omit=dev --audit-level=high`: passed with 0 vulnerabilities.
- `npm ci --dry-run --ignore-scripts`: passed, confirming the pinned lockfile is installable.
- Disposable local Playwright review at `390×844`: 2/2 passed. It covered the account correction surface, read-only phone/no national-ID field, native date control, the 77-province cascade, parent-change clearing, unambiguous postcode assistance, native/numeric input attributes, and no horizontal overflow.
- Component tests cover the address-data loading state and recoverable load-error/retry state. Server/unit coverage includes inactive/direct-action ownership checks, DOB validity, hierarchy tampering, ambiguous postcodes, unchanged legacy rows, doctor identity re-reveal, checkout snapshots, and prescription-order behavior.
