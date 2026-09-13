# Task Control

This is the short, live registry for task routing. It complements `AI_WORKFLOW.md`: that file explains **how** Codex works; this file records **which task, model, approval, and controller apply now**. Do not duplicate product architecture, secrets, patient data, detailed code changes, or full handoffs here.

## Required Routing Gate

Before starting or sending work, every task must:

1. Read `AGENTS.md`, `AI_WORKFLOW.md`, and this file, then check the live Codex task list.
2. Reuse the matching current task when one exists; do not create a duplicate task.
3. Match project and feature owner first. For the same numbered title family, select the largest number: `Doctor ระบบ 5` supersedes `Doctor ระบบ 4`; `Admin ระบบ 6` supersedes `Admin ระบบ 5`.
4. Treat a topic suffix as search context, not as a replacement for ownership. For example, `Admin ระบบ 6 — แก้ไขระบบล็อกอิน` is easier to find later, but must still be checked against the feature scope.
5. Before asking for approval, show: reused/new task, selected model and reason, scope, checks, and whether Production is affected.
6. If the registry, task list, or handoff conflicts, stop and reconcile it before any edit. A user may explicitly choose an older task; different projects and unrelated title families must not be merged by name alone.

## Project Controller

- A task named `สรุปสถานะโปรเจกต์ N` is the Project Controller.
- The active Project Controller is the greatest `N` in that title family after its controller-update announcement.
- The Project Controller performs planning, routing, and review only; it must not edit product code, commit, push, or deploy.
- Every task sends handoff, status, cross-feature decisions, and release requests to that current controller only.
- Opening or messaging an older controller never makes it current again.

| Role | Current task | Task ID | Scope | Default model | Status |
|---|---|---|---|---|---|
| Project Controller | `สรุปสถานะโปรเจกต์ 15 — Project Controller` | `01a098ac-0b5a-7602-892c-85164d0bc07c` | Planning, routing, review, approvals, release status | Terra High | Active; announced successor to `สรุปสถานะโปรเจกต์ 14` |
| Admin owner | `Admin ระบบ 6` | `01a070da-b7b1-7373-80d1-8be0a4f40828` | Admin users, schedules, payments, orders, products, inventory, moderation, audit, and notifications | Terra Medium | Latest Admin owner; reuse before creating another Admin task |
| Admin manual | `อัปเดตคู่มือ Admin พร้อมภาพ` | `01a09876-30a2-76e1-aaaa-da0cdc3a233b` | Current Admin manual and image work | Luna High | Word document complete and visually verified at 7 pages; not committed, pushed, or deployed |
| Superseded manual | `คู่มือการใช้งาน Clinical Ethereality` | `01a0655e-fe11-72d3-b0a9-ef2b4f6852ea` | Historical manual work only | Luna High | Superseded/dormant; do not route new writing here or create a concurrent writer |
| Doctor | `Doctor ระบบ 5` | `01a06c7f-c9b3-7111-9390-292f47230839` | Consultation recording mobile external handoff | Sol High | Code complete locally; Controller review, release, and mobile device UAT pending |
| Zoom integration | `แก้ไข Zoom นอก LINE Mini App` | `01a079aa-206c-7042-981b-63052916c6af` | Doctor Zoom room preparation window | Sol Medium | Production deployed successfully; mobile role-based UAT pending |
| Telemedicine consent and recording | `Telemedicine Consent และ Recording 1` | Not present in the current 50-task live view | Per-booking consent, recording metadata, access control, and provider-ready integration | Sol High | Implementation complete at `faee419`; controller review and 29 targeted tests passed; merge, push, migration, Zoom enablement, and Production deploy are not authorized |

Update this table whenever a task is started, reassigned, handed off, deployed, archived, or replaced. Verify any task not visible in the current live task view before routing new work to it.

## Model Routing

- **Luna High:** routine summaries, bounded read-only audits, QA, image checks, and document checks.
- **Terra High:** Project Controller work that compares multiple sources such as Git, deploy evidence, task records, and handoff documents.
- **Terra Medium:** UI, CRUD, tests, and general code.
- **Sol Medium:** integrations, RCA, and approved merge/push/deploy work with a clear plan.
- **Sol High:** security, authentication, payment, migration, health-data permissions, or complex incidents.
- **GPT-6 Astra High/Max:** only for critical or exceptionally complex work where Sol High is insufficient, such as the hardest multi-system incidents, high-risk architecture decisions, or final review of high-impact Production changes. The controller must explain why Astra is necessary and receive the owner's explicit approval before every use. Never switch an active task to Astra automatically.
- **Ultra:** only after the owner explicitly approves it.

The controller may choose a higher model only when the scope requires it and must explain why before requesting approval. A separate approval is required for Production release, migration, secret rotation, or any other material external change.

## Task Naming

Use a stable role family, its number, and an optional focused topic:

```text
Admin ระบบ 6 — แก้ไขระบบล็อกอิน
Doctor ระบบ 5 — ผลการสั่งยา
สรุปสถานะโปรเจกต์ 14 — Project Controller
```

The number chooses the latest task only within the same role family. The topic enables retrieval when the same subject returns later.

## Long-Task Handoff: Do Not Wait for Confusion

The owner must not wait until a task loses context or gives unreliable answers. The Project Controller checks task health whenever it routes work or reviews a handoff.

Propose a replacement task before continuing when one or more signals appear:

- the task has compacted context or needs repeated recovery of old details;
- its active brief has accumulated several unrelated phases or handoffs;
- it repeats a routing/context error or cannot state its current branch, scope, and next action concisely;
- continuing would require repeatedly reopening older history instead of using a short handoff.

The controller must tell the owner plainly: the current task, why a continuation is recommended, the proposed numbered successor and topic, and the copy-ready handoff. Never create that successor automatically: wait for the owner's approval. The new task must start with the current handoff, branch/worktree status, and exact next action.

## Approval Boundaries

- Approval to investigate or implement does not include merge, push, deploy, migration, environment changes, secret rotation, payment action, or other Production mutation.
- Before a Production change, identify the exact target, safe validation path, and rollback method.
- Never record secrets, credentials, patient data, or raw provider payloads in this file.
