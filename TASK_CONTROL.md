# Task Control

This is the short, live registry for task routing. It complements `AI_WORKFLOW.md`: that file explains **how** Codex works; this file records **which task, model, approval, and controller apply now**. Do not duplicate product architecture, secrets, patient data, detailed code changes, or full handoffs here.

## Required Routing Gate

For implementation, reassignment or release, verify routing at the start and when ownership changes. Read-only questions require this gate only when ownership/status is relevant:

1. Use the governing rules and this registry; verify live task evidence. Reuse unchanged instructions already read rather than repeating the whole document stack.
2. Reuse the matching current task when one exists; do not create a duplicate task.
3. Match project and feature owner first. For the same numbered title family, select the largest number: `Doctor ระบบ 6` supersedes `Doctor ระบบ 5`; `Admin ระบบ 6` supersedes `Admin ระบบ 5`.
4. Treat a topic suffix as search context, not as a replacement for ownership. For example, `Admin ระบบ 6 — แก้ไขระบบล็อกอิน` is easier to find later, but must still be checked against the feature scope.
5. Before asking for approval, show: reused/new task, selected model and reason, scope, checks, and whether Production is affected.
6. Reconcile ownership conflicts before the affected edit/dispatch; safe read-only checks may continue. Inspect known task IDs when limited lists omit them. Respect an explicit older-task choice; do not merge unrelated projects/title families.

## Project Controller

- A task named `สรุปสถานะโปรเจกต์ N` is the Project Controller.
- The active Project Controller is the greatest `N` in that title family after its controller-update announcement.
- The Project Controller performs planning, routing, and review only; it must not edit product code, commit, push, or deploy.
- Every task sends handoff, status, cross-feature decisions, and release requests to that current controller only.
- Opening or messaging an older controller never makes it current again.

| Role | Current task | Task ID | Scope | Default model | Status |
|---|---|---|---|---|---|
| Project Controller | `สรุปสถานะโปรเจกต์ 15 — Project Controller` | `01a098ac-0b5a-7602-892c-85164d0bc07c` | Planning, routing, review, approvals, release status | Terra High | Active; live identity verified 2026-09-15 |
| Admin owner | `Admin ระบบ 6` | `01a070da-b7b1-7373-80d1-8be0a4f40828` | Admin users, schedules, payments, orders, products, inventory, moderation, audit, and notifications | Terra Medium | Latest Admin owner; reuse before creating another Admin task |
| Admin manual | `อัปเดตคู่มือ Admin พร้อมภาพ` | `01a09876-30a2-76e1-aaaa-da0cdc3a233b` | Current Admin manual and image work | Luna High | Word document complete and visually verified at 7 pages; not committed, pushed, or deployed |
| Superseded manual | `คู่มือการใช้งาน Clinical Ethereality` | `01a0655e-fe11-72d3-b0a9-ef2b4f6852ea` | Historical manual work only | Luna High | Superseded/dormant; do not route new writing here or create a concurrent writer |
| Doctor | `Doctor ระบบ 6` | `01a09f7f-4003-7582-9a53-4fe2aad3b754` | Patient identity and full-slot Zoom attendance | Sol High | Identity verified 2026-09-15; verify latest release/UAT evidence before release routing |
| Community | `Community ระบบ 3 — ปักหมุดโพสต์` | `01a0a090-6576-7a43-b5b7-07dc9cd2a88e` | Community pinned posts | Sol High | Handoff reports `1b230a9` deployed; UAT partial (3-pin/fourth-rejection and owner notification UI untested); restored UAT post remains published/unpinned |
| Zoom integration | `แก้ไข Zoom นอก LINE Mini App` | `01a079aa-206c-7042-981b-63052916c6af` | Doctor Zoom room preparation window | Sol Medium | Production deployed successfully; mobile role-based UAT pending |
| Telemedicine consent and recording | `Telemedicine Consent และ Recording 1` | Not present in the current 50-task live view | Per-booking consent, recording metadata, access control, and provider-ready integration | Sol High | Implementation complete at `faee419`; controller review and 29 targeted tests passed; merge, push, migration, Zoom enablement, and Production deploy are not authorized |

Update verified milestones with date/evidence. Undated rows are legacy snapshots: their release or approval wording does not grant or revoke current authority. Check latest scoped owner approval and handoff before acting. The 2026-09-15 refresh verified Controller/Doctor/Community identities, not Production health or older manual/Zoom statuses.

## Model Routing

These are owner-approved routing defaults, not automatic Codex settings or a guarantee of credit savings. Choose by risk and required evidence, not task label alone. A read-only security/health-data permission review may need Sol High even though routine document QA uses Luna High.

Keep small explanations and evidence-based status replies in the current task when it already has the needed context; do not add a worker handoff just to change models. For an actual assignment, announce the selected task, model and reasoning effort once. Apply an approved selection through the task settings/tool; if the selection cannot be verified, report it as unverified rather than claiming the Markdown changed it. Preserve an explicitly selected model, never silently substitute one, and obtain approval for escalation outside the agreed routing policy.

- **Luna High:** routine summaries, bounded read-only audits, QA, image checks, and document checks.
- **Terra High:** Project Controller work that compares multiple sources such as Git, deploy evidence, task records, and handoff documents.
- **Terra Medium:** UI, CRUD, tests, and general code.
- **Sol Medium:** integrations, RCA, and approved merge/push/deploy work with a clear plan.
- **Sol High:** security, authentication, payment, migration, health-data permissions, or complex incidents.
- **GPT-6 Astra High/Max:** only for critical or exceptionally complex work where Sol High is insufficient, such as the hardest multi-system incidents, high-risk architecture decisions, or final review of high-impact Production changes. The controller must explain and obtain approval before changing the selected model. An owner-selected model is already authorized for that task; do not request approval again each turn. Never switch an active task to Astra automatically.
- **Ultra:** only after the owner explicitly approves it.

Ultra is a reasoning-effort setting, not a separate model. Its approval must identify the model and scope; ordinary routing permission is not Ultra approval.

The controller may choose a higher model only when the scope requires it and must explain why before requesting approval. A separate approval is required for Production release, migration, secret rotation, or any other material external change.

## Task Naming

Use a stable role family, its number, and an optional focused topic:

```text
Admin ระบบ 6 — แก้ไขระบบล็อกอิน
Doctor ระบบ 6 — ยืนยันตัวตนผู้ป่วย
สรุปสถานะโปรเจกต์ 15 — Project Controller
```

The number chooses the latest task only within the same role family. The topic enables retrieval when the same subject returns later.

## Long-Task Handoff: Do Not Wait for Confusion

The owner must not wait until a task loses context or gives unreliable answers. The Project Controller checks task health whenever it routes work or reviews a handoff.

Propose a replacement task before continuing when one or more signals appear:

- it repeatedly cannot recover scope/evidence even after a concise handoff; context compaction alone is not a failure signal;
- its active brief has accumulated several unrelated phases or handoffs;
- it repeats a routing/context error or cannot state its current branch, scope, and next action concisely;
- continuing would require repeatedly reopening older history instead of using a short handoff.

The controller must tell the owner plainly: the current task, why a continuation is recommended, the proposed numbered successor and topic, and the copy-ready handoff. Never create that successor automatically: wait for the owner's approval. The new task must start with the current handoff, branch/worktree status, and exact next action.

## Approval Boundaries

- Approval to investigate or implement does not include merge, push, deploy, migration, environment changes, secret rotation, payment action, or other Production mutation.
- Before a Production change, identify the exact target, named release worker, safe validation path and rollback method.
- Record approval scope once. Continue ordinary steps already authorized; ask again only for a materially different target/action, destructive scope or risk outside the approved recovery plan.
- Scoped local edits and proportionate tests are normal implementation steps, subject to tool permissions. This does not authorize Production mutations or bypass tool approvals.
- Diagnose failures read-only first. Retry only when evidence shows it is safe and within scope; inspect actual state before repeating mutations. Never blindly retry migrations, payments, deletions or restarts. Stop the affected action if safety/authority is uncertain and state the exact decision needed.
- Never record secrets, credentials, patient data, or raw provider payloads in this file.
