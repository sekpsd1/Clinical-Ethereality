# Project State

## Project

Clinical Ethereality

## Phase

Project scaffolding and frontend foundation.

The project now contains a minimal Next.js 15, React 19, TypeScript, and Tailwind CSS scaffold. The implementation remains intentionally thin: it establishes the app shell, design-system token locations, shared customer footer navigation, and route placeholders without building the full backend integration or redesigning finalized Stitch screens.

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

- Doctor list
- Doctor profile and booking
- Consultation PromptPay checkout
- Waiting room
- Live consultation
- Advice log

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

## Next Recommended Step

Import or reference the finalized Stitch source/tokens/assets, then map exact Stitch tokens into Tailwind and build the reusable primitive components before composing the reviewed Stitch screens.
