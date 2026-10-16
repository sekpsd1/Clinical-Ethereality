# Consult single-category local follow-up, 2026-10-17

TASK: Keep only สูตินรีแพทย์ in Customer Consult doctor-list category strip
STATUS: complete
IMPLEMENTATION: verified
RELEASE: not-requested
UAT: partial
BRANCH: codex/consult-single-category
COMMIT: implementation commit containing this file; exact hash in final response
CHANGED: ConsultDoctorList.tsx category array only (three labels to one; correct prior visible spelling สูตินารีแพทย์ to สูตินรีแพทย์); updated customer-consult-service-navigation.test.tsx; scoped PROJECT_STATE and this handoff
CHECKS: Read component, approved/active Doctor query, route and shell/footer. Chips have no handler/state/filter behavior; card map is unconditional. No query/domain changes required. Customer strip test now requires exactly one correctly spelled chip and absence of two removed choices with empty data; three heterogeneous synthetic Doctors preserve all cards/specialties/prices/booking hrefs and recommendation content. Existing Doctor queue test remains unchanged because Doctor-side headings are out of scope.17 tests across these two files passed; lint and TypeScript passed. Affected local build result recorded in final response. Actual SSR components/AppShell/FooterNav and existing tokens rendered at390x844 with usePathname=/consult, local images, synthetic data and all other network blocked. Before/after semantic card and footer arrays identical; no horizontal overflow. Independent image diff bounds x55..327/y164..198 confined to category strip; all pixels y210..844 (cards/footer) identical. Screenshots visually reviewed.
APPROVAL SCOPE: Controller17 routed the owner's narrow local-only category removal; no Doctor/card/data/specialty/pricing/recommendation deletion or redesign. Current model retained; no model change claimed.
RESIDUAL STATE: Receipt implementation/style and Production closeout preserved as ancestors through e95854c. Production published source99df95a unchanged; no push, deploy, database/provider/environment writes, external auth or cleanup operation. Isolated preview browser closed; no fixtures created in database.
NEXT ACTION / OWNER: Controller17 review exact UI-only commit and screenshots; Production release needs separate authorization
RISKS / FOLLOW-UP: Strip is still nonfiltering as before. This does not restrict the available Doctor list to gynecology or alter Doctor-side service headings. Real LINE-device UAT not run. Receipt release is already complete independently; owning-Customer/LINE PDF UAT remains pending, not repeated or claimed passed here.
NEEDS PLAN REVIEW: yes

## Local preview artifacts

Final local `npm run build` completed successfully with68 pages; lint, `npm run typecheck`,17 targeted tests and `git diff --check` passed on the unchanged product/test tree before commit. No checks were skipped.

In this task's visualization directory (outside repo/public app):

- `consult-category-before-390.png`
- `consult-category-after-390.png`
- `consult-category-before.json` / `consult-category-after.json`: synthetic card/footer/strip metrics only
- `consult-category-preview.cjs`: isolated preview runner; does not use authentication/database or allow booking clicks
