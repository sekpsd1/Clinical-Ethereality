# Four-case cleanup handoff, 2026-10-09

TASK: Owner-approved cleanup of four old live test consultations
STATUS: complete
IMPLEMENTATION: verified
RELEASE: deployed
UAT: passed
BRANCH: codex/purge-four-websthai-live
COMMIT: 6f3596b (deployed operator); documentation closeout commit separate
CHANGED: Scoped operator scripts, graph guards, retained-file checks, tests and runbook. Exactly four target Consultations and their scoped dependencies deleted once in Production.
CHECKS: Final Production dry-run confirmed Customer and assigned Doctor match and exact four UI-observed IDs, Bangkok dates 16–18 September 2026. Four verified Payments; no Prescriptions; two recording metadata rows. Four Zoom files and one Drive file preserved; one recording already had no external copy. Six private payment/evidence files preserved with matching content hashes. Execute reported verified=true with all preservation flags true. Doctor UI: live=0 and completed=17. Health HTTP 200/status ok. Local final operator revision passed 28 guard tests, lint, TypeScript and diff checks; earlier product release passed host build.
APPROVAL SCOPE: User requested deletion of only four old live test consultations, backup first, preserve accounts, schedules, all other consultations, Zoom and Drive files. User explicitly confirmed the Customer/Doctor interpretation after the automatic approval rejection; approved push and execution then succeeded.
RESIDUAL STATE: Full Plesk backup task 1501 completed at 100%; retained restore entry created 2026-10-09 18:07:46 ICT, size 2.69 GB, comment "Pre-cleanup full backup four test consultations 20261009 target c8cd7542a34c". One scoped deletion transaction; zero provider/file deletions, migrations or environment saves. Prior source release used one build and one app restart; subsequent operator-only deploys used no restart. Backup and retained external/private files remain available.
NEXT ACTION / OWNER: none; do not rerun completed cleanup
RISKS / FOLLOW-UP: One recording had no external copy before cleanup; no restoration of this previously absent file was requested. Recovery of deleted records requires the retained backup.
NEEDS PLAN REVIEW: no
