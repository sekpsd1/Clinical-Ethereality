# Assessment consent layout release, 2026-10-16

TASK: Owner-approved assessment health-consent mobile layout release
STATUS: complete
IMPLEMENTATION: verified
RELEASE: deployed
UAT: partial
BRANCH: codex/assessment-consent-width
COMMIT: 8e0b4c0fa4beb9cafe79de986dc6df4b90d5b2c1 (published and deployed); release closeout documentation local only
CHANGED: ConsultAssessmentIntro.tsx widens the unchanged summary, reduces mobile gutters/gaps, wraps title/action and retains minimum 14px text. PROJECT_STATE.md and this runbook record evidence. No booking popup, consent text/version, server action or data change.
CHECKS: Local build 68 pages, lint, TypeScript, existing consent UI test 1/1 and diff checks passed. Actual-component previews at 280/320/375px and CSS root-font 200% passed overflow/touch checks. Remote main independently confirmed exact deployed hash at closeout. Plesk Pull/Deploy followed exact source verification; non-migration preflight, npm ci, isolated Zoom dependency install and build:plesk-host passed, with 68 pages and 138 static/24 public files. One explicit restart, zero recovery restarts. Public GET smoke: health HTTP 200/status ok, default title Bangkok Cytogenetics Clinic, all 43 consent paragraphs in order, version 2026-10-16 and unchanged separate recording disclosure. Production /consult/assessment at identical 393px viewport: summary 154 to 254px; page 1689 to 1318px; heading 72 to 48px. Visible text and four bullets unchanged; minimum font 14px; checkbox required and unchecked; no touch overlap. Document scrollWidth/clientWidth both 378px (393px viewport includes scrollbar); no horizontal overflow or clipped text. Hidden version field exists; browser redacts input values, so unchanged assessment version 2026-09-12 is verified by source/local checks, not a Production value read. The earlier strict width-equality and redacted-value predicates were corrected/qualified, not treated as product regressions.
APPROVAL SCOPE: Owner-authorized exact layout commit plus preserved f74058b release documentation, fast-forward push and Plesk release. No additional push/build/restart during closeout.
RESIDUAL STATE: Existing scheduled backup 2026-10-16 01:11 and full backup 2026-10-09 18:07 (2.69 GB) retained. No migrations, business-data writes, consent acceptance, booking/payment, environment saves, LINE/Zoom/Drive/provider or scheduler changes. Before/after Production screenshots remain in the task visualization directory as assessment-production-before-20261016.png and assessment-production-after-20261016.png.
NEXT ACTION / OWNER: Customer QA/owner to test actual LINE mobile and native OS font scaling; no consent submitted by agent.
RISKS / FOLLOW-UP: CSS font stress is not native LINE-device UAT. Rollback source is 4fd825434b1ace30bc46179f25ce163555e120a6; prefer reviewed forward revert of layout commit, preserving branding/popup and newer work. Rebuild/restart only under approved rollback authority; no database restore needed for this UI-only release. Do not rerun the unrelated completed four-case cleanup.
NEEDS PLAN REVIEW: no
