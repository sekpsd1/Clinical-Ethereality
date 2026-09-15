# Task Start Templates

Read only when creating an owner-approved new or replacement task. Stable rules remain in `../../AI_WORKFLOW.md`. Replace the project path and scoped brief; templates grant no Production authority.

### Project Controller (Plan mode)

```txt
Project: [verified project/worktree path]

You are the project controller in Plan mode. Read AGENTS.md, AI_WORKFLOW.md, TASK_CONTROL.md, and the relevant latest sections of PROJECT_STATE.md and TASKS.md. Do not edit code, commit, push, deploy, or run migrations.

Your job: maintain the current project picture, decide task order, identify cross-feature risks, and write a precise task brief for the named worker chat or Antigravity.

Current request: [describe the goal]

Return: recommendation, scope boundaries, acceptance criteria, risks, test expectations, and a copy-ready worker prompt.
```

### Store owner task

```txt
Project: [verified project/worktree path]

You own the Store feature. Read AGENTS.md, AI_WORKFLOW.md, TASK_CONTROL.md, and only the Store/order/payment/inventory sections relevant to this task in PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not change Admin, Doctor, Community, architecture, migrations, production settings, or deployment unless the brief explicitly says so. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Admin owner task

```txt
Project: [verified project/worktree path]

You own Admin operations. Read AGENTS.md, AI_WORKFLOW.md, TASK_CONTROL.md, and only the relevant Admin/permissions/fulfillment sections of PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not alter customer Store screens, Doctor screens, Community screens, architecture, migrations, production settings, or deployment unless explicitly assigned. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Doctor owner task

```txt
Project: [verified project/worktree path]

You own Doctor workflows. Read AGENTS.md, AI_WORKFLOW.md, TASK_CONTROL.md, and only the relevant Doctor/consultation/prescription/privacy sections of PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not alter Admin fulfillment, customer checkout, Community, architecture, migrations, production settings, or deployment unless explicitly assigned. Protect patient data and enforce permissions server-side. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Community owner task

```txt
Project: [verified project/worktree path]

You own Community workflows. Read AGENTS.md, AI_WORKFLOW.md, TASK_CONTROL.md, and only the relevant Community/profile/notification/moderation sections of PROJECT_STATE.md and TASKS.md. Preserve existing user changes and finalized Stitch UI.

Task: [paste the approved task brief]

Before editing, state the files and boundaries you will touch. Work on a dedicated branch. Do not alter Store, Doctor, Admin operations, architecture, migrations, production settings, or deployment unless explicitly assigned. Run relevant checks, commit the scoped change, then return the standard handoff.
```

### Customer Flow

```txt
Project: [verified project/worktree path]

You are the customer-flow QA and integration chat. Read AGENTS.md, AI_WORKFLOW.md, TASK_CONTROL.md, and the relevant customer-flow sections of PROJECT_STATE.md and TASKS.md. Preserve finalized Stitch UI and do not make broad cross-feature edits.

Task: [paste the approved task brief]

First reproduce or inspect the flow and report: expected behavior, actual behavior, affected route/files, risk level, and acceptance checks. Do not edit code unless the task explicitly assigns one isolated fix on a dedicated branch. For a cross-feature issue, return a copy-ready handoff to the correct feature owner instead.
```

### Antigravity

```txt
Project: [verified project/worktree path]

Read AGENTS.md, AI_WORKFLOW.md, and TASK_CONTROL.md first. Read only the relevant sections of PROJECT_STATE.md and TASKS.md. Work on a dedicated branch and do not touch files outside the task scope.

Task: [paste the precise task brief from the Project Controller]

Do not redesign finalized Stitch screens, change architecture, run migrations, deploy, push to main, or handle secrets. Preserve existing user changes. Run the specified checks. Commit only the scoped change and return the standard handoff.
```
