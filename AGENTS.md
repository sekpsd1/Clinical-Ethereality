# Agent Instructions

This repository is in the planning phase for Clinical Ethereality, a secure web app for clinical aesthetics commerce, consultation, pharmacy fulfillment, and community workflows.

## Current Priority

Do not generate the full app yet. The current task is to preserve planning, architecture, user roles, and product direction until the user explicitly asks to start implementation.

## Product Direction

Clinical Ethereality should feel:

- Clinical
- Elegant
- Calm
- Operationally useful
- Privacy-conscious
- Trustworthy
- Operationally clear across customer, doctor, pharmacist, and admin workflows

Avoid turning the first screen into a generic marketing landing page unless the user explicitly asks for one. When implementation starts, build the actual usable product, consultation, pharmacy, order, and community workflows first.

## Recommended Architecture

Default to:

- Modular monolith inside a single Next.js application
- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS
- Tailwind implementation of the finalized Stitch design system
- lucide-react
- MySQL
- Prisma
- Next.js Server Actions
- LINE LIFF plus JWT authentication
- Cloudinary or S3-compatible object storage
- Zoom SDK for video consultations
- Thai QR plus Slip Verification API for payments
- Vercel deployment

Ask before making architecture changes. If an architecture change is approved, document the reason in `PROJECT_STATE.md`.

Implementation structure:

- Keep routes in `app/*` thin.
- Treat the Stitch specification as the source of truth for all UI and UX.
- Do not redesign finalized Stitch screens.
- Build the reviewed Stitch screens first before adding new flows.
- Put domain logic in `features/*`.
- Put reusable UI in `components/*`.
- Put design tokens, variants, and component contracts in `lib/design-system/*`.
- Put cross-cutting services in `lib/*`.
- Put Prisma schema, migrations, and seed data in `prisma/*`.
- Use Server Actions for first-party mutations.
- Use route handlers for LINE callbacks, webhooks, health checks, and integration endpoints.
- Validate server inputs with Zod.
- Enforce permissions on the server for every sensitive action.

## Data And Compliance Guidance

Treat patient data, prescriptions, patient logs, payment records, order records, community moderation records, images, and attachments as sensitive.

When implementation begins:

- Model role ownership and role-based access through the agreed main entities
- Model customer/patient, doctor, pharmacist, and admin permissions explicitly
- Keep prescription, order, payment, and community moderation records auditable
- Avoid public access to sensitive records
- Include audit metadata on sensitive entities
- Prefer non-destructive updates for prescriptions, payment reviews, shipment tracking, and reward point adjustments
- Store file metadata in the database and file bytes in object storage
- Keep production HIPAA or health-data compliance decisions explicit

If protected health information will be stored in production, use vendors that can support the necessary compliance posture and business associate agreements.

## UI Guidance

Build mobile-first LINE LIFF screens from the finalized Stitch design system. Favor clear, uncluttered layouts for customers, doctors, pharmacists, and admins, but do not reinterpret or redesign finalized Stitch layouts.

Final customer footer navigation:

- `Consult`
- `Store`
- `Community`
- `Profile`

Use one shared `FooterNav` implementation for these tabs. Payment and checkout screens keep the active tab of the parent flow. Live consultation should hide footer navigation to reduce distraction. Notification Center is a sub-screen, not a root footer tab.

Use:

- Stitch tokens for colors, typography, spacing, radius, glass surfaces, shadows, and motion
- Stitch-specified teal treatment where defined
- Consistent Stitch glassmorphism for app surfaces
- The shared footer navigation component for primary app areas
- Real photography over illustrations
- Lists, compact cards, and status rows for mobile operational views
- Tabs for related record sections
- Badges for status
- Drawers, bottom sheets, inline edits, or dedicated screens for focused edits
- Icons from lucide-react
- Clear empty states

Avoid:

- Redesigning Stitch layouts
- Introducing UI patterns not present in Stitch without approval
- One-off Tailwind values when a Stitch token exists
- Desktop-first layouts
- Cluttered screens
- Unnecessary modal popups
- Oversized marketing hero sections for the app shell
- Decorative gradients and abstract blobs
- Card-inside-card layouts
- Exposing sensitive details outside authenticated routes

Admin workflows should minimize steps while preserving safety for sensitive actions such as payment review, prescription handling, inventory changes, and moderation.

Reusable component rules:

- Build reusable UI components from Stitch patterns before composing full pages.
- Keep component names in PascalCase.
- Use domain component names such as `ProductCard`, `OrderCard`, `ConsultationCard`, and `PrescriptionCard`.
- Keep `FooterNav` as the single source for footer navigation across all screens.
- Keep screen-specific styling out of domain components unless Stitch requires it.

Stitch screen priority:

- Consult: doctor list, doctor booking, consult payment checkout, waiting room, live consultation, advice log.
- Store: marketplace, product detail, checkout, payment success and tracking.
- Community/Profile: profile, community hub, create post, article detail/comments, notification center, search results.

Supporting screens such as booking confirmation, payment pending/rejected, appointment detail, prescription verification status, order detail, saved articles, shipping addresses, and settings should be added only when needed to connect the designed MVP flows.

## Documentation Practice

Keep these files current:

- `README.md`: product, architecture, and setup direction
- `PROJECT_STATE.md`: decisions, current status, and known constraints
- `TASKS.md`: backlog and implementation phases
- `.env.example`: required configuration keys
- `AGENTS.md`: instructions for future coding agents

When meaningful decisions are made, update `PROJECT_STATE.md` before or alongside code changes.

## Development Practice

When coding starts:

- Read existing files before editing
- Keep changes scoped
- Do not refactor unrelated files
- Preserve user edits
- Keep components modular
- Reuse components whenever possible
- Follow the Stitch design system strictly
- Do not redesign the UI
- Maintain footer navigation consistency across all screens
- Use TypeScript strict mode
- Keep UI mobile-first
- Ask before architecture changes
- Add tests proportional to the risk of the change
- Prefer established project patterns over new abstractions
- Update `PROJECT_STATE.md` after major tasks
- Explain modified files in the final response
- Run build and lint before completion when scripts are available
- If build or lint cannot be run, explain why in the final response

Do not introduce full application scaffolding until the user asks for implementation.
