# Project State

## Project

Clinical Ethereality

## Phase

Consult frontend implementation.

The project now contains a Next.js 15, React 19, TypeScript, and Tailwind CSS scaffold plus the first customer Consult flow screens converted from Figma/Stitch references. The implementation remains frontend-only: it uses static mock data and local image assets, establishes route structure and visual flow, but does not yet include backend integration, authentication, database models, payment verification, Zoom SDK, or admin scheduling.

## Current Decisions

- Product category: clinical aesthetics commerce, consultation, pharmacy, and community web app
- Primary experience: authenticated platform for customers/patients, doctors, pharmacists, and admins
- Architecture pattern: modular monolith inside a single Next.js app
- Primary mutation pattern: Next.js Server Actions
- Route handlers reserved for LINE callback, webhooks, health checks, and integration endpoints
- Recommended frontend framework: Next.js 15 with App Router and React 19
- Recommended language: TypeScript
- Recommended database: MySQL
- Recommended ORM: Prisma
- Recommended styling: Tailwind CSS implementing the finalized Stitch design system
- Recommended backend approach: Next.js Server Actions
- Recommended authentication: LINE LIFF plus JWT
- Recommended video call integration: Zoom SDK
- Recommended payment approach: Thai QR plus Slip Verification API
- Recommended deployment: Vercel app with managed MySQL
- Recommended storage: Cloudinary or S3-compatible object storage for attachments and images
- Recommended validation: Zod
- Recommended testing: Vitest and Playwright
- UI/UX source of truth: finalized Stitch design specification
- Frontend architecture priority: reusable mobile-first components for LINE LIFF
- State management direction: server-first with Server Components, Server Actions, React Hook Form for complex forms, URL state for filters, and minimal client context
- Final customer footer navigation: `Consult | Store | Community | Profile`
- Implementation priority: build the 16 reviewed Stitch screens first, then add only supporting connector screens needed to complete the MVP flow

## Architecture Summary

The app should be organized around domain modules rather than technical silos. Routes should stay thin, reusable UI should live in `components/*`, business logic should live in `features/*`, and cross-cutting services should live in `lib/*`.

Core layers:

- Presentation: mobile-first React routes and components
- Server actions: validated mutations and permission enforcement
- Domain services: role-aware business logic
- Data access: Prisma over MySQL
- Integrations: LINE LIFF, JWT, Zoom SDK, Thai QR, Slip Verification API, Cloudinary or S3, email, SMS, monitoring

Core route areas:

- Public products and articles
- Auth and LINE callback
- Authenticated customer app
- Doctor consultation workflow
- Pharmacist prescription and fulfillment workflow
- Admin operations
- Webhooks for payment and Zoom events

## Stitch Screen Inventory

Consult:

- Doctor list: implemented at `/consult`
- Doctor profile and booking: implemented at `/consult/booking/somchai`
- Consultation PromptPay checkout: implemented at `/consult/payment`
- Waiting room: implemented at `/consult/waiting-room`
- Live consultation: implemented at `/consult/live`
- Advice log: implemented at `/consult/advice-log`

Store:

- Health marketplace
- Product detail
- Store checkout
- Payment success and tracking

Community and Profile:

- User profile
- Community hub
- Create new post
- Article/post detail and comments
- Notification center
- Community search results

## Decisions Still Needed

- Confirm exact MVP scope
- Choose managed MySQL host
- Choose Cloudinary or S3-compatible storage
- Confirm LINE LIFF channel setup
- Confirm JWT issuing, expiry, refresh, and revocation strategy
- Decide whether production will store protected health information
- Decide whether HIPAA-eligible vendors and BAAs are required from day one
- Decide whether customer product browsing and order tracking are public, authenticated, or hybrid
- Confirm Zoom SDK implementation approach
- Choose Slip Verification API provider
- Decide whether Thai QR payments are manual-review MVP or fully automated after slip verification
- Community is included in MVP using the reviewed Stitch screens
- Decide whether delivery tracking is internal status only or carrier-integrated
- Define brand direction and visual identity
- Obtain or reference the finalized Stitch token/specification export before implementation
- Map Stitch colors, typography, spacing, radius, glass surfaces, shadows, and footer navigation into Tailwind
- Confirm whether any Stitch source files can be exported for exact tokens, images, and spacing values
- Collect client intake materials listed in `CLIENT_INTAKE.md`
- Confirm PDPA Privacy Policy, Terms of Service, health-data consent, teleconsultation consent, refund/cancellation policy, and community guidelines
- Confirm company legal name, tax ID, billing address, parcel sender address, and support contact
- Confirm doctor onboarding data, medical license, consultation fee, schedule, and official profile photo
- Confirm product catalog, FDA numbers, medical-standard product images, prices, stock, and prescription requirements
- Confirm pharmacy license data, pharmacist license data, and prescription verification SOP
- Confirm PromptPay account, bank account details, and SlipOK/EasySlip provider/API details

## Proposed MVP

The first build should likely include:

- LINE LIFF login with JWT session handling
- Mobile-first authenticated app shell with persistent bottom navigation
- Stitch-based design system implementation
- Tailwind theme mapped from Stitch tokens
- Reusable UI primitives and domain components
- Final customer footer navigation: `Consult | Store | Community | Profile`
- Consult flow from doctor list through advice log
- Store flow from marketplace through payment success and tracking
- Community flow from hub through post creation, detail/comments, notifications, and search
- Profile hub with settings links
- Role-based access control and permission helpers
- Admin dashboard
- Customer/patient profiles
- Doctor users and profiles
- Pharmacist users and profiles
- Product catalog
- Inventory foundation
- Orders, order items, and order status tracking
- Thai QR payment instructions, slip upload, and payment review workflow
- Slip Verification API integration boundary
- Zoom consultation metadata and launch path
- Patient history captured through users and consultations
- Prescription creation
- Prescription verification
- Shipment tracking status updates
- Articles, comments, likes, reporting, and moderation foundation
- Notifications foundation
- Reward points foundation
- Audit metadata on sensitive entities

## Supporting Screens To Add Only As Needed

- Booking confirmation
- Payment pending
- Payment rejected
- Appointment detail
- Prescription verification status
- Order from prescription
- Order detail
- Saved articles
- Shipping addresses
- Settings

These screens should reuse Stitch-derived components and visual patterns from the 16 reviewed screens. Do not create unrelated new UI patterns.

## App Folder Structure

Use this structure when implementation starts:

- `app/`: route groups, layouts, pages, route handlers, and webhooks
- `components/`: reusable UI, layout, navigation, and domain presentation components
- `features/`: domain actions, queries, services, schemas, and feature-specific components
- `lib/`: auth, database, environment, permissions, validation helpers, design-system tokens, and integration clients
- `prisma/`: schema, migrations, and seed data
- `public/`: static assets and photography placeholders
- `tests/`: unit, integration, and Playwright tests

## API Plan

- Use Server Actions for first-party mutations.
- Use route handlers only for external callbacks and webhooks.
- Validate inputs with Zod at the server boundary.
- Enforce permissions in server code, not only in UI.
- Keep all sensitive prescription, payment, consultation, and order data behind authenticated routes.

## Frontend Architecture Decisions

- Follow the Stitch design system strictly.
- Do not redesign finalized UI.
- Use Stitch as the source of truth for Tailwind tokens and reusable components.
- Maintain one shared footer navigation implementation with `Consult | Store | Community | Profile`.
- Keep layouts mobile-first for LINE LIFF.
- Prefer server-first state management and avoid global client state unless justified.

## Current Implementation Handoff

Completed in the current frontend pass:

- Project scaffold: Next.js 15.5, React 19, TypeScript strict mode, Tailwind CSS, ESLint, Prisma placeholder schema, and `package-lock.json`.
- App shell: shared customer `AppShell`, global `TopAppBar`, and shared `FooterNav` for root customer areas.
- Design system foundation: Stitch-inspired tokens in `lib/design-system/tokens.ts`, variants helper, component contracts, and added shadows/backgrounds needed by the Consult screens.
- Consult doctor list: `/consult`, implemented from Figma with doctor cards, search bar, filter chips, local doctor images, and booking CTA.
- Doctor booking: `/consult/booking/somchai`, implemented from Figma with doctor bio card, calendar mock, time slots, and booking CTA.
- Consult payment checkout: `/consult/payment`, implemented from Figma with booking summary, PromptPay QR, slip upload mock, and payment submit CTA.
- Waiting room: `/consult/waiting-room`, implemented from Figma with payment-confirmed status, countdown, doctor brief, preparation checklist, camera/mic test CTA, and join consultation CTA.
- Live consultation: `/consult/live`, implemented from Stitch zip reference with compact video shell, chat transcript, prescription attachment, composer, and end-call CTA.
- Advice log: `/consult/advice-log`, implemented from Stitch zip reference with doctor summary, medical note, prescription list, attachment, order medicine CTA, and PDF download CTA.
- Static assets copied into `public/images/doctors`, `public/images/profiles`, and `public/images/payments`.
- Verification passed after the latest changes: `npm run lint`, `npm run build`, and `npx tsc --noEmit`.
- Local dev server was restarted cleanly at `http://localhost:3001`.

Known frontend caveats:

- Consult screens use static mock data only.
- Some deep-flow screens intentionally use custom headers/footers based on Stitch references instead of the root `FooterNav`.
- `LiveConsultation` and `AdviceLog` were refined from Stitch `.zip` exports, not live Figma MCP, because the Starter plan MCP read quota was exhausted.
- Running `next build` while `next dev` is active can corrupt `.next` dev chunks on this Windows setup. After builds, stop dev server, clear `.next`, and restart `npm run dev -- -p 3001`.

Not implemented yet:

- LINE LIFF/JWT authentication and route protection.
- Prisma domain models, migrations, seed data, and database queries.
- Admin schedule editor for doctor availability.
- Server Actions for booking, payment submission, slip upload, or slot locking.
- Thai QR generation and Slip Verification API integration.
- Zoom SDK integration for live consultations.
- File upload/storage integration for payment slips, prescriptions, PDFs, or attachments.
- Store, Community, Profile, Admin, pharmacist, and doctor back-office workflows beyond placeholders.
- Automated tests beyond lint/build/typecheck.

## Risk Notes

- Compliance requirements affect vendor selection and architecture
- Consultations, prescriptions, payment records, order records, shipment tracking, reward point adjustments, and images should be treated as sensitive records
- Ownership and role scope should be represented on the main entities without expanding the database beyond the agreed entity list unless needed
- AI features should wait until permissions, audit logging, and data boundaries are established
- Payments, prescriptions, and pharmacy fulfillment introduce additional regulatory and operational complexity

## Workspace Notes

- The workspace contains planning documentation and is initialized as a git repository
- Latest pushed planning commit: `18b9ab2 Document Stitch navigation plan`
- Application framework scaffold has started with Next.js 15, React 19, TypeScript, and Tailwind CSS
- Dependencies have been added through npm with `package-lock.json`
- Prisma has a placeholder MySQL schema only; domain models and migrations are deferred until the MVP entity boundary is confirmed
- Customer app routes currently redirect from `/` into the Stitch navigation shell at `/consult`
- Shared customer footer navigation is implemented with the final tabs: `Consult | Store | Community | Profile`
- Latest implemented frontend area: customer Consult flow from doctor list through advice log

## Next Recommended Step

Start the next Stitch flow, preferably Store (`HealthMarketplace`, `ProductDetail`, `StoreCheckout`, `PaymentSuccessTracking`), or begin backend foundations for doctor availability/admin scheduling if the Consult flow should become data-driven next.
