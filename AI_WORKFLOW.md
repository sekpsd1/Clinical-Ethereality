# Clinical Ethereality: AI Chat Workflow

Use this file to coordinate Codex chats and Antigravity without duplicating work or losing project context.

## Sources Of Truth

1. `AGENTS.md` — repository and safety rules.
2. `PROJECT_STATE.md` — current product decisions, completed work, constraints, and known risks.
3. `TASKS.md` — active backlog and task status.
4. This file — chat roles, handoff format, and Git working rules.

`CHAT_HANDOFF.md` is historical only. Do not treat its old branch, setup, or next-step details as the current project state.

## Roles

| Chat | Mode | Owns | Does not own |
| --- | --- | --- | --- |
| **Project Controller** (the user-designated status chat) | Plan mode | Priorities, architecture decisions, task briefs, cross-feature review, final acceptance plan | Editing product code, committing, deploying |
| **Store ระบบ 6** | Normal | Customer store, catalog, cart, checkout, payment/order tracking, and store-specific tests | Admin operations, doctor/prescription authoring, community |
| **Admin ระบบ 4** | Normal | `admin` operations: users, schedules, payments, orders, products, inventory, moderation, audit, admin notifications | Customer store UI/checkout, doctor UI, community UI |
| **Doctor ระบบ 4** | Normal | Doctor consultations, assigned patients, consultation records, doctor prescriptions, doctor-side tests | Admin fulfillment, customer store checkout, community |
| **Community ระบบ 2** | Normal | Community articles, posts, comments, moderation-facing content behavior, community notifications/profile content | Store, doctor, admin operations |
| **Customer Flow** | Normal | End-to-end customer-flow QA, reproduction steps, acceptance criteria, and only explicitly assigned isolated fixes | Owning broad shared features or editing other chats' active files |
| **Antigravity** | Worker | One self-contained, written task on its own branch | Product decisions, unreviewed merge/deploy, concurrent edits to an active Codex task |

The **Customer Flow** chat is a QA/integration owner by default because customer journeys touch Store, Consult, Community, and Profile code. It must report a defect to the feature-owning chat unless the Project Controller assigns it a specific isolated fix.

## Core Rules

1. One active writer per feature or file area. Never let two chats or Antigravity edit the same area at the same time.
2. Every implementation task has one bounded outcome, acceptance criteria, and a named owner.
3. Use a dedicated branch for a task. Do not commit directly to `main`.
4. Before a task edits code, inspect only the relevant files plus the applicable parts of `PROJECT_STATE.md` and `TASKS.md`.
5. On completion, run relevant checks, commit the scoped change, and return the handoff format below.
6. The Project Controller reviews changes that affect more than one feature, permissions, payments, health data, schema, authentication, deployment, or Git integration.
7. Do not share API keys, passwords, tokens, production database credentials, or patient data in any chat prompt or committed file.

## Task Routing: Codex Or Antigravity

The Project Controller chooses the worker before writing a task brief. Use Antigravity only when **all four** conditions are true:

1. **Bounded:** one feature area, a concrete requested outcome, and no unresolved product or architecture decision.
2. **Isolated:** no other active chat is editing the same files or flow; the task can use its own branch and be reverted by one commit.
3. **Safe authority:** no production deploy, credentials, live payment action, database migration, schema decision, authentication/permission design, or exposure of patient data.
4. **Verifiable:** clear acceptance criteria and commands or manual checks can prove the result.

Choose the normal Codex owner chat instead when the task is a small focused fix, requires its existing specialized context, or Antigravity handoff/review would cost more time than implementation.

Keep the task with the Project Controller for planning and send it to a normal Codex chat for implementation when it crosses feature ownership, affects security/privacy/permissions/payments, needs a product decision, or is unclear. The Project Controller reviews every Antigravity handoff before it is merged, deployed, or handed to another feature.

### Routing Question For Every New Task

Before assigning work, the Project Controller must answer in its task brief:

```txt
WORKER: Project Controller | [Codex owner chat] | Antigravity
WHY THIS WORKER: [one sentence]
SCOPE / FILE AREA: [bounded area]
ACCEPTANCE CHECKS: [specific checks]
```

If any Antigravity condition is uncertain, default to the relevant Codex owner chat.

## Start Prompts

Paste the applicable prompt at the beginning of a new Codex chat. Replace the text in brackets before sending.

### Project Controller (Plan mode)

```txt
Project: C:\Projects\clinical-ethereality

You are the project controller in Plan mode. Read AGENTS.md, AI_WORKFLOW.md, and the relevant latest sections of PROJECT_STATE.md and TASKS.md. Do not edit code, commit, deploy, or run migrations.

Your job: maintain the current project picture, decide task order, identify cross-feature risks, and write a precise task brief for the named worker chat or Antigravity.

Current request: [describe the goal]

Return: recommendation, scope boundaries, acceptance criteria, risks, test expectations, and a copy-ready worker prompt.
```

### Store ระบบ 6

```txt
Project: C:\Projects\clinical-ethereality

You own the Store feature. Read AGENTS.md, AI_WORKFLOW.md, and only the Store/order/payment/inventory sections relevant to this task in PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not change Admin, Doctor, Community, architecture, migrations, production settings, or deployment unless the brief explicitly says so. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Admin ระบบ 4

```txt
Project: C:\Projects\clinical-ethereality

You own Admin operations. Read AGENTS.md, AI_WORKFLOW.md, and only the relevant Admin/permissions/fulfillment sections of PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not alter customer Store screens, Doctor screens, Community screens, architecture, migrations, production settings, or deployment unless explicitly assigned. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Doctor ระบบ 4

```txt
Project: C:\Projects\clinical-ethereality

You own Doctor workflows. Read AGENTS.md, AI_WORKFLOW.md, and only the relevant Doctor/consultation/prescription/privacy sections of PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not alter Admin fulfillment, customer checkout, Community, architecture, migrations, production settings, or deployment unless explicitly assigned. Protect patient data and enforce permissions server-side. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Community ระบบ 2

```txt
Project: C:\Projects\clinical-ethereality

You own Community workflows. Read AGENTS.md, AI_WORKFLOW.md, and only the relevant Community/profile/notification/moderation sections of PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not alter Store, Doctor, Admin operations, architecture, migrations, production settings, or deployment unless explicitly assigned. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Customer Flow

```txt
Project: C:\Projects\clinical-ethereality

You are the customer-flow QA and integration chat. Read AGENTS.md, AI_WORKFLOW.md, and the relevant customer-flow sections of PROJECT_STATE.md and TASKS.md. Preserve finalized Stitch UI and do not make broad cross-feature edits.

Task: [paste the approved task brief]

First reproduce or inspect the flow and report: expected behavior, actual behavior, affected route/files, risk level, and acceptance checks. Do not edit code unless the task explicitly assigns one isolated fix on a dedicated branch. For a cross-feature issue, return a copy-ready handoff to the correct feature owner instead.
```

### Antigravity

```txt
Project: C:\Projects\clinical-ethereality

Read AGENTS.md and AI_WORKFLOW.md first. Read only the relevant sections of PROJECT_STATE.md and TASKS.md. Work on a dedicated branch and do not touch files outside the task scope.

Task: [paste the precise task brief from the Project Controller]

Do not redesign finalized Stitch screens, change architecture, run migrations, deploy, push to main, or handle secrets. Preserve existing user changes. Run the specified checks. Commit only the scoped change and return the standard handoff.
```

## Standard Handoff

Every worker must end with this exact structure so it can be pasted into the **active Project Controller chat**:

```txt
TASK: [name]
STATUS: complete | blocked | needs-review
BRANCH: [branch name]
COMMIT: [hash, or none]
CHANGED: [files and behavior changed]
CHECKS: [commands run and result]
RISKS / FOLLOW-UP: [none, or concise list]
NEEDS PLAN REVIEW: yes | no
```

## When A Chat Is Full Or A New Chat Is Needed

Yes, a new chat can continue the same work, but it does **not** automatically inherit the full reasoning or memory of the prior chat. Start the replacement chat with:

1. Its role-specific Start Prompt above.
2. The final Standard Handoff from the old chat.
3. The current task brief from the **active Project Controller**.
4. Any uncommitted-change warning, branch name, and the exact next action.

Do not ask a replacement chat to read the entire repository by default. `AGENTS.md`, this file, the relevant `PROJECT_STATE.md`/`TASKS.md` sections, and the handoff are the minimum context needed to continue safely.

## Replacing The Project Controller Chat

The controller is a **role**, not a fixed chat title or number. When the current status chat becomes long, make the replacement chat the active Project Controller with the Plan-mode Start Prompt and its latest controller handoff.

Then send this one update to every active worker chat:

```txt
Controller update: the active Project Controller is now [new chat title].
Send all future Standard Handoffs and requests for cross-feature decisions to that chat. Do not use the previous controller chat for new work.
```

### Controller Naming Convention

Name every controller chat `สรุปสถานะโปรเจกต์ N`, where `N` increases by one each time a replacement controller is created. After the controller-update announcement, the **highest announced number** is the active Project Controller (for example, `สรุปสถานะโปรเจกต์ 7` replaces `สรุปสถานะโปรเจกต์ 6`).

The announcement is required: a previously opened old chat does not become active again merely because it is viewed or receives a message.


## Auto Model Routing

Use the lowest model/thinking level that is appropriate for the task. This routing is a default, not a guarantee of credit or price, and may be overridden when the owner specifies a model or effort.

- Luna High: summaries, read-only audits/QA, image/document inspection, and high-volume low-risk work.
- Terra Medium: UI, CRUD, tests, and general coding.
- Sol Medium: integrations, RCA, and bounded deploy/migration work with a clear plan.
- Sol High: security/auth/payment, complex migration/recovery, or Production incidents.
- Ultra/Max: never select automatically; require separate owner approval.
- Escalate only when there is evidence of greater complexity, risk, or failure, and state the reason in the handoff.
- The Project Controller selects model/thinking when assigning each task; workers must not change it without a reason or expand scope.
