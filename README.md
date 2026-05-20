# Clinical Ethereality

Clinical Ethereality is a web application for clinical aesthetics commerce, consultation, and care coordination. The product should help customers browse products, consult doctors, receive prescriptions, track orders, and participate in a moderated community while giving doctors, pharmacists, and admins the operational tools they need.

This repository is currently in the planning and architecture phase. Do not generate the full app until the project direction, stack, data model, and initial workflows are confirmed.

## Project Purpose

Clinical Ethereality will provide a secure clinical marketplace and care platform for aesthetics, wellness, or pharmacy-adjacent services. It should combine product discovery, doctor consultation, prescription workflow, pharmacy fulfillment, order tracking, and community participation in one polished experience.

The app should support:

- Product browsing and ordering
- Doctor consultations and patient logs
- Prescription writing and verification
- Pharmacy fulfillment and order status updates
- Community participation with moderation
- Admin visibility into users, products, payments, inventory, and content

The tone of the product should feel clinical, elegant, and trustworthy: precise enough for regulated workflows, but warm enough for a high-touch patient experience.

## Target Users

Primary users:

- Customers or patients who browse products, consult doctors, join the community, and track orders
- Doctors who provide video consultations, write prescriptions, and review patient logs
- Pharmacists who verify prescriptions, prepare medicine, and update order status
- Admins who manage users, products, payments, inventory, and community moderation

Secondary users:

- Finance or operations staff
- Compliance reviewers
- External consultants or support users, if explicitly enabled later

## User Roles

### Customer / Patient

- Browse products
- Consult doctors
- Join community
- Track orders

### Doctor

- Provide video consultations
- Write prescriptions
- Access assigned patient logs

### Pharmacist

- Verify prescriptions
- Prepare medicine
- Update order status

### Admin

- Manage users
- Manage products
- Review payments
- Manage inventory
- Moderate community content

## Core Features

Initial product scope:

- Role-based authentication for customers, doctors, pharmacists, and admins
- Product catalog with categories, product details, availability, and inventory status
- Customer or patient profiles with contact details, consultation history, patient logs, and order history
- Video consultation workflow for doctors and patients
- Prescription creation by doctors
- Prescription verification by pharmacists
- Order management from checkout through preparation, fulfillment, and delivery tracking
- Payment review workflow for admins
- Inventory management for products and medicine
- Community posts, comments, reporting, and admin moderation
- Secure document, prescription, and attachment support
- Notification-ready architecture for email, even if messaging is added later

Future scope:

- Online appointment scheduling
- Payment gateway automation
- Delivery carrier integrations
- Before-and-after image comparison
- Marketing segmentation
- Advanced patient portal
- AI-assisted note drafting, treatment summaries, and task suggestions
- Multi-location support

## Recommended Tech Stack

Selected stack:

- Frontend: Next.js 15, React 19, TypeScript
- Styling: Tailwind CSS implementing the finalized Stitch design system
- Backend: Next.js Server Actions
- Database: MySQL
- ORM: Prisma
- Authentication: LINE LIFF plus JWT
- Customer entry: LINE Mini App/LINE LIFF is required; customers without LINE must create or use a LINE account before accessing the app
- Email login: deferred until after the LINE Mini App MVP is complete; email may be captured as profile/contact data first
- Storage: Cloudinary or S3-compatible object storage
- Video call: Zoom SDK
- Payment: Thai QR plus Slip Verification API
- Email: Resend, Postmark, or SendGrid
- Validation: Zod
- Forms: React Hook Form
- Testing: Vitest for unit tests, Playwright for end-to-end tests
- Hosting: Vercel

Preferred first implementation path:

1. Scaffold Next.js 15 with React 19, TypeScript, and Tailwind CSS
2. Translate the finalized Stitch design system into reusable Tailwind tokens and components
3. Add Prisma with MySQL
4. Implement LINE LIFF login and JWT session handling
5. Add Zoom SDK integration boundaries for consultations
6. Add Thai QR payment records and Slip Verification API review flow
7. Deploy on Vercel with managed MySQL and object storage

## System Architecture

Clinical Ethereality should use a modular monolith architecture inside a single Next.js application. This keeps the MVP simple to deploy on Vercel while still separating business domains cleanly enough to scale later.

Primary layers:

- Presentation layer: mobile-first React screens, route groups, shared UI components, persistent footer navigation, and Tailwind tokens generated from the finalized Stitch design system.
- Server action layer: Next.js Server Actions for mutations such as checkout, consent acceptance, prescription verification, payment review, inventory updates, comments, likes, and admin moderation.
- Query layer: server-side data loaders for product browsing, orders, consultations, prescriptions, inventory, articles, notifications, and customer consent status.
- Domain layer: role-aware business logic grouped by domain, with permissions checked before sensitive reads or writes.
- Data layer: Prisma models and repositories over MySQL.
- Integration layer: LINE LIFF, JWT, Zoom SDK, Cloudinary or S3, Thai QR generation, Slip Verification API, email, monitoring, and analytics.

Core domains:

- Identity and access: LINE LIFF login, JWT session handling, user roles, and role-scoped permissions.
- Commerce: products, inventory, cart or checkout state, orders, order items, payments, shipment tracking, and reward points.
- Clinical consultation: consultations, Zoom session metadata, doctor workflow, prescriptions, pharmacist verification, and patient history.
- Content and community: articles, comments, likes, notifications, and moderation.
- Admin operations: user management, product management, inventory review, payment review, prescription queues, content moderation, and reporting.

Recommended request flow:

1. User enters through LINE Mini App/LINE LIFF or an authenticated app route.
2. Middleware verifies JWT state and resolves the current user role.
3. Route-level loaders fetch only role-appropriate data through domain services.
4. Forms submit to Server Actions with Zod validation.
5. Server Actions enforce permissions, write through Prisma, call integrations when needed, and create notifications or audit metadata.
6. UI updates using redirect, revalidation, optimistic state where safe, or a fresh server render.

## App Folder Structure

```txt
clinical-ethereality/
  app/
    (public)/
      page.tsx
      articles/
      products/
    (auth)/
      line/
      callback/
    (app)/
      layout.tsx
      dashboard/
      products/
      consultations/
      prescriptions/
      orders/
      rewards/
      notifications/
      profile/
    admin/
      layout.tsx
      users/
      products/
      inventory/
      orders/
      payments/
      prescriptions/
      content/
    api/
      auth/
      line/
      webhooks/
        payments/
        zoom/
  components/
    ui/
    layout/
    navigation/
    products/
    consultations/
    prescriptions/
    orders/
    payments/
    inventory/
    articles/
    notifications/
  features/
    auth/
    users/
    doctors/
    pharmacists/
    products/
    inventory/
    consultations/
    prescriptions/
    orders/
    payments/
    shipments/
    articles/
    comments/
    likes/
    notifications/
    rewards/
  lib/
    auth/
    db/
    design-system/
      tokens.ts
      variants.ts
      component-contracts.ts
    env/
    permissions/
    validations/
    integrations/
      line/
      zoom/
      payments/
      storage/
      messaging/
  prisma/
    schema.prisma
    migrations/
    seed.mjs
  public/
    images/
  tests/
    unit/
    integration/
    e2e/
```

Folder rules:

- Keep route files thin; put business logic in `features/*`.
- Keep reusable interface pieces in `components/*`.
- Keep cross-cutting utilities in `lib/*`.
- Keep integration clients isolated under `lib/integrations/*`.
- Keep Prisma access behind domain services or repositories so permission checks stay consistent.

## Frontend Architecture

The finalized Stitch design is the source of truth for UI and UX. Do not redesign screens, invent alternate layouts, or change the visual hierarchy unless the Stitch specification changes.

Frontend architecture should convert Stitch into implementation primitives:

- Design tokens: colors, typography, spacing, radius, shadows, blur, borders, opacity, and motion values from Stitch.
- Layout primitives: mobile-first screen shells, safe-area wrappers, section stacks, sticky headers when present in Stitch, and persistent footer navigation.
- UI primitives: buttons, inputs, cards, chips, tabs, badges, list rows, product media, status indicators, bottom sheets, drawers, and toast/inline feedback.
- Domain components: product cards, order rows, consultation cards, prescription status panels, payment slip upload, inventory rows, article cards, comment rows, notification items, and reward point summaries.
- Feature compositions: screen-level assemblies that use domain components but do not introduce new visual patterns.

Build the component system from the finalized Stitch screens in this order:

1. Extract tokens from Stitch.
2. Map tokens into Tailwind theme and CSS variables.
3. Build UI primitives.
4. Build layout/navigation components.
5. Build domain components.
6. Compose full screens only after the component catalog is stable.

## Final App Navigation

Use one shared footer navigation across the customer LINE LIFF app:

```txt
Consult | Store | Community | Profile
```

Navigation mapping:

- `Consult`: doctor selection, doctor profile and booking, consultation payment, waiting room, live consultation, advice log.
- `Store`: health marketplace, product detail, prescription medicine ordering, checkout, payment success, order tracking.
- `Community`: community hub, create post, article/post detail, comments, search results, notifications entry points.
- `Profile`: user profile, advice history, orders or medicine list, saved articles, shipping address, settings, logout.

Footer rules:

- `FooterNav` is the single implementation for customer-facing footer navigation.
- Root screens should show footer navigation.
- Deep task screens may keep footer navigation when Stitch shows it, but live consultation should hide it to reduce distraction.
- Comment-focused screens should either hide footer navigation while the keyboard is open or reserve safe-area spacing above it.
- Payment and checkout screens should keep the active tab from the parent flow: consult payments use `Consult`, store checkout uses `Store`.
- Notification Center is a sub-screen, not a root tab. It opens from header/profile/community entry points and routes users to the relevant destination.

## Stitch Screen Map

Consult screens already designed:

- `ConsultDoctorList`: browse/search doctors and categories.
- `DoctorBooking`: doctor profile, calendar, time slot selection, booking CTA.
- `ConsultPaymentCheckout`: PromptPay payment and slip upload for consultation booking.
- `ConsultWaitingRoom`: payment-confirmed waiting room, countdown, device check, join room button.
- `LiveConsultation`: Zoom/live consultation mode with chat, call controls, and prescription attachment.
- `AdviceLog`: consultation summary, doctor note, prescription items, PDF download, and order medicine CTA.

Store screens already designed:

- `HealthMarketplace`: marketplace home, category shortcuts, recommended products, cart entry.
- `ProductDetail`: medication detail, prescription required notice, advice log selector, sticky purchase CTA.
- `StoreCheckout`: order summary, PromptPay QR, slip upload, delivery address, payment submit.
- `PaymentSuccessTracking`: verified payment result, pharmacy preparation timeline, shipment/order tracking.

Community/Profile screens already designed:

- `UserProfile`: profile hub, verified member status, advice count, posts count, settings links, logout.
- `CommunityHub`: featured verified content, category chips, feed cards, likes/comments/share.
- `CreatePost`: new post form, image upload, category selector, post CTA.
- `ArticleDetail`: article/post detail, action bar, comments, sticky comment composer.
- `NotificationCenter`: notifications list, unread state, mark-all-read, routing to related content/order/consult events.
- `CommunitySearchResults`: search keyword, filter chips, result cards, author meta, likes.

Implementation should create the screens above first before adding extra flows.

## Missing Supporting Screens

Build these only as needed to connect the designed MVP flows:

- `BookingConfirmation`: lightweight confirmation between booking selection and consult payment.
- `PaymentPending`: shown after slip upload while verification is pending.
- `PaymentRejected`: shown when slip verification fails, with re-upload path.
- `AppointmentDetail`: consult appointment status, schedule, doctor info, and entry to waiting room.
- `PrescriptionVerificationStatus`: shows whether pharmacist verification is pending, approved, or rejected.
- `OrderFromPrescription`: focused store entry for medicines from an advice log.
- `OrderDetail`: detailed order status beyond the success/tracking summary.
- `SavedArticles`: accessible from Profile.
- `ShippingAddresses`: accessible from Profile and checkout.
- `Settings`: account, notification, privacy, and logout settings.

Defer these until after the designed screens are implemented:

- Advanced admin console
- Full doctor back office
- Full pharmacist back office
- Carrier-integrated delivery tracking
- AI-assisted notes or content
- Marketing and promotion management

## Tailwind Theme Structure

Tailwind should mirror Stitch tokens rather than define a separate design language.

Recommended structure:

```txt
app/
  globals.css
lib/
  design-system/
    tokens.ts
    variants.ts
    component-contracts.ts
tailwind.config.ts
```

Theme groups:

- `colors`: Stitch semantic colors such as primary, surface, glass, text, muted, success, warning, danger, border, and overlay.
- `fontFamily`: Stitch font choices and fallbacks.
- `fontSize`: Stitch text scale for labels, body, titles, section headers, and numeric emphasis.
- `spacing`: Stitch spacing rhythm for mobile layouts.
- `borderRadius`: Stitch radii for buttons, cards, sheets, inputs, and media.
- `boxShadow`: Stitch elevation and glass surface shadows.
- `backdropBlur`: Stitch glassmorphism blur levels.
- `borderColor`: Stitch glass and divider borders.
- `screens`: mobile-first breakpoints, with desktop only as progressive enhancement.
- `zIndex`: footer navigation, headers, drawers, bottom sheets, and toasts.

Token rules:

- Use semantic token names, not raw color names, in components.
- Do not hard-code one-off colors or spacing when a Stitch token exists.
- Keep glassmorphism consistent through shared surface classes.
- Footer navigation dimensions, active state, and safe-area padding must come from shared tokens.

## Reusable Component Plan

Foundation components:

- `AppShell`
- `Screen`
- `SafeArea`
- `FooterNav`
- `TopBar`
- `Section`
- `Stack`
- `GlassSurface`
- `StatusBadge`
- `EmptyState`
- `LoadingState`

UI primitives:

- `Button`
- `IconButton`
- `TextField`
- `SearchField`
- `SelectField`
- `TextareaField`
- `Checkbox`
- `Switch`
- `Tabs`
- `Chip`
- `Avatar`
- `BottomSheet`
- `Drawer`
- `Toast`

Domain components:

- `ProductCard`
- `ProductMedia`
- `InventoryStatus`
- `OrderCard`
- `OrderStatusTimeline`
- `PaymentSlipUploader`
- `ConsultationCard`
- `ZoomJoinPanel`
- `PrescriptionCard`
- `PrescriptionVerificationPanel`
- `ArticleCard`
- `CommentItem`
- `LikeButton`
- `NotificationItem`
- `RewardPointsSummary`
- `AdminActionBar`
- `DoctorCard`
- `BookingCalendar`
- `TimeSlotButton`
- `PromptPayQrPanel`
- `PaymentStatusBadge`
- `SlipUploadBox`
- `AdviceLogSelector`
- `OrderTrackingTimeline`
- `CommunityPostCard`
- `SearchResultCard`
- `CommentComposer`
- `ProfileSettingsItem`

Component rules:

- Components must be modular and reusable.
- Components should accept typed props that reflect domain state, not raw database records unless appropriate.
- Components should use Stitch variants instead of local style overrides.
- Avoid page-only components unless a pattern appears once and cannot reasonably be reused.
- Keep footer navigation consistent by using one shared `FooterNav`.
- Build the designed Stitch screens before inventing new page patterns.

## UI Component Naming Convention

Use PascalCase component names and domain prefixes where helpful.

Naming rules:

- Foundation/layout: `AppShell`, `Screen`, `FooterNav`, `TopBar`, `GlassSurface`
- Generic UI primitives: `Button`, `TextField`, `StatusBadge`, `BottomSheet`
- Domain display components: `ProductCard`, `OrderCard`, `ConsultationCard`, `PrescriptionCard`
- Domain workflow components: `PaymentSlipUploader`, `PrescriptionVerificationPanel`, `OrderStatusTimeline`
- Admin components: `AdminUserRow`, `AdminProductEditor`, `AdminPaymentReviewCard`
- Hooks: `useCurrentUser`, `useFooterNavItems`, `useOptimisticLike`
- Server actions: `createOrderAction`, `verifyPaymentSlipAction`, `createPrescriptionAction`
- Queries/loaders: `getProductList`, `getCurrentUserOrders`, `getAdminPaymentQueue`

File naming:

- Component files: `PascalCase.tsx`
- Server action files: `actions.ts`
- Query files: `queries.ts`
- Validation files: `schema.ts`
- Types: `types.ts`
- Constants: `constants.ts`

## State Management Approach

Prefer server-first state management.

Recommended approach:

- Server state: fetch through Server Components, domain queries, and Prisma-backed loaders.
- Mutations: use Server Actions with Zod validation and permission checks.
- Form state: use React Hook Form for complex forms; simple forms can use native form actions.
- Optimistic UI: use React 19 optimistic patterns for likes, comment submission, and low-risk UI feedback.
- URL state: use search params for filters, tabs, sort order, and admin queue views.
- Client state: use React context only for app shell concerns such as footer nav, LIFF readiness, transient UI state, and toasts.
- External state libraries: avoid until a clear need appears; add Zustand only if cross-screen client state becomes genuinely complex.
- Cache refresh: use Next.js revalidation, redirects, and fresh server renders after successful mutations.

Do not store sensitive prescription, payment, or patient data in long-lived client state.

## Database Needs

The app should use a relational database because the domain has clear entities, ownership boundaries, audit needs, and reporting requirements.

Main database entities:

- users
- auth_sessions
- doctors
- pharmacists
- consultations
- prescriptions
- products
- inventory
- orders
- order_items
- payments
- shipment_tracking
- articles
- comments
- likes
- notifications
- consent_records
- reward_points

Entity responsibilities:

- users: shared account, LINE identity, JWT session subject, role, profile, and patient-facing data
- auth_sessions: persisted login sessions with refresh token hashes, expiry, revocation state, user agent, and IP metadata
- doctors: doctor credentials, availability, consultation settings, and approval state
- pharmacists: pharmacist credentials, pharmacy workflow permissions, and approval state
- consultations: doctor-patient consultation requests, scheduling, Zoom session references, and status
- prescriptions: prescription records written by doctors and verified by pharmacists
- products: sellable product or medicine catalog records
- inventory: stock quantity, thresholds, and inventory movement state
- orders: customer order header, order status, totals, and ownership
- order_items: product-level order lines, quantity, price, and fulfillment details
- payments: Thai QR payment records, uploaded slip metadata, verification result, and review status
- shipment_tracking: delivery state, tracking number, courier details, and timeline events
- articles: community or educational content posts
- comments: threaded or flat comments on articles
- likes: user reactions for articles or comments
- notifications: in-app, email, or LINE notification records
- consent_records: versioned PDPA, Terms, health-data, teleconsultation, and prescription/pharmacy fulfillment acceptance records
- reward_points: earned, spent, adjusted, and expired customer points

## Database Schema Proposal

Suggested Prisma model direction:

- `users`: `id`, `lineUserId`, `displayName`, `email`, `phone`, `avatarUrl`, `role`, `status`, `rewardBalance`, `createdAt`, `updatedAt`
- `auth_sessions`: `id`, `userId`, `refreshTokenHash`, `status`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`, `createdAt`, `updatedAt`
- `doctors`: `id`, `userId`, `licenseNumber`, `specialty`, `bio`, `status`, `approvedAt`, `createdAt`, `updatedAt`
- `pharmacists`: `id`, `userId`, `licenseNumber`, `status`, `approvedAt`, `createdAt`, `updatedAt`
- `consultations`: `id`, `patientId`, `doctorId`, `status`, `scheduledAt`, `zoomMeetingId`, `zoomJoinUrl`, `summary`, `createdAt`, `updatedAt`
- `prescriptions`: `id`, `consultationId`, `patientId`, `doctorId`, `pharmacistId`, `status`, `notes`, `verifiedAt`, `createdAt`, `updatedAt`
- `products`: `id`, `name`, `slug`, `description`, `price`, `imageUrl`, `requiresPrescription`, `status`, `createdAt`, `updatedAt`
- `inventory`: `id`, `productId`, `quantity`, `reservedQuantity`, `lowStockThreshold`, `updatedById`, `createdAt`, `updatedAt`
- `orders`: `id`, `userId`, `status`, `subtotal`, `discountTotal`, `shippingTotal`, `grandTotal`, `createdAt`, `updatedAt`
- `order_items`: `id`, `orderId`, `productId`, `prescriptionId`, `quantity`, `unitPrice`, `lineTotal`, `createdAt`
- `payments`: `id`, `orderId`, `method`, `amount`, `status`, `qrPayload`, `slipImageUrl`, `verificationPayload`, `reviewedById`, `reviewedAt`, `createdAt`, `updatedAt`
- `shipment_tracking`: `id`, `orderId`, `carrier`, `trackingNumber`, `status`, `eventsJson`, `updatedById`, `createdAt`, `updatedAt`
- `articles`: `id`, `authorId`, `title`, `slug`, `coverImageUrl`, `body`, `status`, `publishedAt`, `createdAt`, `updatedAt`
- `comments`: `id`, `articleId`, `userId`, `parentId`, `body`, `status`, `createdAt`, `updatedAt`
- `likes`: `id`, `userId`, `articleId`, `commentId`, `createdAt`
- `notifications`: `id`, `userId`, `type`, `channel`, `title`, `body`, `readAt`, `metadataJson`, `createdAt`
- `consent_records`: `id`, `userId`, `type`, `version`, `acceptedAt`, `revokedAt`, `ipAddress`, `userAgent`, `metadataJson`
- `reward_points`: `id`, `userId`, `sourceType`, `sourceId`, `points`, `direction`, `expiresAt`, `createdAt`

Key relationships:

- One `user` can have one `doctor` profile or one `pharmacist` profile when applicable.
- One `user` can have many `auth_sessions` for active LINE Mini App sessions.
- One `user` can create many `orders`, `consultations`, `comments`, `likes`, `notifications`, `consent_records`, and `reward_points`.
- One `consultation` can produce prescriptions.
- One `prescription` can be verified by a pharmacist and referenced by prescription-required order items.
- One `order` has many `order_items`, one or more `payments`, and shipment tracking records.
- One `product` has one inventory record and many order items.
- One `article` has many comments and likes.

Schema notes:

- Use enums for user role, account status, auth session status, consultation status, prescription status, order status, payment status, article status, notification channel, and reward direction.
- Store third-party responses in JSON columns only for audit/debug fields, not as the primary business state.
- Add indexes for `lineUserId`, `role`, `status`, `slug`, `scheduledAt`, `orderId`, `userId`, `doctorId`, `pharmacistId`, and tracking numbers.
- Add unique constraints for product slugs, article slugs, LINE user IDs, doctor license numbers, pharmacist license numbers, and one like per user/content target.

Important data requirements:

- Every sensitive record should have created, updated, and actor metadata where practical
- Consultations, prescriptions, payment verification records, shipment updates, and reward point adjustments should avoid silent destructive updates
- Attachments should store metadata in MySQL and file bytes in Cloudinary or S3-compatible object storage
- Ownership and role scope should be represented on the main entities without adding extra tables unless needed
- Audit metadata should be included on sensitive records and major state changes

## API Structure

Prefer Server Actions for first-party form mutations and route handlers only for external callbacks, webhooks, and API-style integration endpoints.

Server Action groups:

- `features/auth/actions.ts`: LINE login completion, logout, JWT refresh or re-authentication.
- `features/products/actions.ts`: create, update, publish, archive, and inventory-safe product changes.
- `features/orders/actions.ts`: create order, update order status, cancel order, add shipment tracking.
- `features/payments/actions.ts`: create Thai QR payment, upload slip, verify slip, approve or reject payment.
- `features/consultations/actions.ts`: request consultation, assign doctor, schedule consultation, update consultation status.
- `features/prescriptions/actions.ts`: create prescription, update prescription, verify prescription, reject prescription.
- `features/articles/actions.ts`: create article, publish article, hide article, report content.
- `features/comments/actions.ts`: create comment, hide comment, report comment.
- `features/likes/actions.ts`: like or unlike article/comment.
- `features/notifications/actions.ts`: mark read, mark all read.
- `features/rewards/actions.ts`: award points, spend points, adjust points.

Server Action conventions:

- Keep route files thin; place first-party mutations in the owning `features/*/actions.ts` module.
- Start each action file with `"use server"` and keep browser-only code out of action modules.
- Parse `FormData` through Zod schemas before reading business fields.
- Use `lib/actions/server-actions.ts` for shared form-action state, recoverable validation errors, and `FormData` conversion in new action work.
- Resolve the authenticated session and enforce permissions before sensitive reads or writes.
- Wrap multi-record state changes in Prisma transactions.
- Write audit logs for sensitive consent, payment, prescription, order, inventory, moderation, reward, and staff-account changes.
- Revalidate every affected route after successful state changes; redirect only after durable writes are complete.

Route handlers:

- `GET /auth/line`: LINE LIFF auth entry screen for customer sessions.
- `POST /api/auth/line/session`: exchange a LINE LIFF ID token for app JWT cookies and a persisted auth session.
- `GET /api/auth/session`: return the current app session.
- `POST /api/auth/refresh`: rotate a persisted refresh session.
- `POST /api/auth/logout`: revoke the current persisted refresh session and clear cookies.
- `POST /api/auth/dev-session`: local-only customer/admin session bypass when `ENABLE_DEV_AUTH_BYPASS=true` and `NODE_ENV` is not production.
- `POST /api/auth/line/callback`: handle LINE callback if the LIFF flow requires a server callback.
- `POST /api/webhooks/payments`: receive payment or slip verification webhook callbacks.
- `POST /api/webhooks/zoom`: receive Zoom meeting lifecycle events if enabled.
- `GET /api/health`: deployment and monitoring health check.

Current integration placeholders:

- `/api/auth/line/callback` redirects safe internal callback state back into the app and returns `501` for unconfigured POST handling.
- `/api/webhooks/payments` and `/api/webhooks/zoom` require configured webhook secrets and return `501` until provider-specific persistence is implemented.

Permission pattern:

- Customer/patient: own profile, own consultations, own prescriptions where allowed, own orders, articles, comments, likes, notifications, and reward points.
- Doctor: assigned consultations, assigned patient history through consultations, and prescriptions they write.
- Pharmacist: prescriptions awaiting verification, verified prescriptions, order preparation state, and shipment updates.
- Admin: user management, products, inventory, payments, orders, prescriptions, articles, moderation, notifications, and reporting.

API design rules:

- Validate all inputs with Zod at the server boundary.
- Enforce permissions inside actions and route handlers, not only in the UI.
- Return typed action results for recoverable validation errors.
- Redirect or revalidate after successful mutations.
- Never expose sensitive prescription, payment, or patient data to public routes.

## MVP Scope

MVP must prove the full care-commerce loop:

- LINE LIFF login with JWT session handling
- Mobile-first authenticated app shell with persistent bottom navigation
- Customer product browsing
- Product detail pages with real photography support
- Basic product and inventory management for admins
- Order creation with order items
- Thai QR payment instruction and slip upload
- Admin payment review with Slip Verification API integration boundary
- Consultation request and doctor assignment
- Zoom consultation metadata and launch path
- Doctor prescription creation
- Pharmacist prescription verification
- Pharmacist order preparation and order status updates
- Shipment tracking status updates
- Articles, comments, likes, and moderation foundation
- Notifications foundation
- Reward points earning/spending foundation
- Admin dashboard for users, products, inventory, payments, prescriptions, orders, and content
- Reusable frontend component foundation based on the finalized Stitch design system
- Tailwind theme tokens mapped from Stitch
- Shared footer navigation used consistently across all MVP screens

MVP exclusions:

- Full automated carrier integration
- Full automated payment capture beyond slip verification workflow
- Customer email/password login before the LINE Mini App MVP is complete
- AI-assisted clinical or content generation
- Multi-location operations
- Advanced marketing segmentation
- Native mobile apps

## Development Phases

1. Planning and architecture: finalize docs, MVP scope, entity model, UX rules, and integration decisions.
2. Project scaffold: initialize Next.js 15, React 19, TypeScript strict mode, Tailwind, Prisma, MySQL, lint, build, and test tooling.
3. Stitch design system implementation: extract Stitch tokens, map Tailwind theme, build primitives, and establish footer navigation consistency.
4. App shell and frontend architecture: mobile-first LINE LIFF shell, route groups, protected layouts, state boundaries, and reusable domain components.
5. Auth and permissions: LINE LIFF, JWT sessions, role-scoped access, middleware, and permission helpers.
6. Database foundation: Prisma schema, migrations, seed data, indexes, enums, and entity relationships.
7. Commerce: products, inventory, orders, order items, Thai QR, slip upload, payment review, reward points, and shipment tracking.
8. Consultation and pharmacy: consultations, Zoom SDK integration, prescriptions, pharmacist verification, preparation flow, and status updates.
9. Articles and community: articles, comments, likes, moderation, and notifications.
10. Admin operations: admin dashboard, low-step management workflows, reporting basics, and operational search.
11. Quality and deployment: unit tests, integration tests, Playwright smoke tests, Vercel preview, staging, production readiness, monitoring, and backups.

## Authentication System

The authentication system should support:

- LINE Mini App/LINE LIFF login as the required customer/patient entry point
- LINE identity as the primary customer account identity
- No standalone customer email/password or guest account flow for MVP
- Email login may be added only after the LINE Mini App MVP is complete
- JWT session handling for app authorization
- Prisma-backed users and auth sessions, with refresh tokens stored as hashes rather than raw tokens
- Middleware protection for customer routes and role boundaries for future admin, doctor, and pharmacist areas
- Local development bypass for previewing protected screens before LINE LIFF credentials are configured; production still requires LINE
- Role-based access control
- Role-scoped access for doctors, pharmacists, and admins
- Separate permissions for customer, doctor, pharmacist, and admin
- Account invitation flow for doctors, pharmacists, and admins
- Patient portal access that is limited to the patient's own consultations, logs, prescriptions, and orders
- Session protection suitable for sensitive health-adjacent data

Recommended roles:

- customer or patient: browse products, consult doctors, join community, track orders, and manage own profile
- doctor: conduct video consultations, write prescriptions, and access assigned patient logs
- pharmacist: verify prescriptions, prepare medicine, and update pharmacy/order status
- admin: manage users, products, payments, inventory, community content, settings, and reporting

HIPAA note:

If this product will store protected health information in production, the stack must use HIPAA-eligible vendors with signed BAAs. That vendor decision should be made before production launch, not after.

## Admin Dashboard Requirements

The admin dashboard should prioritize fast operational scanning rather than marketing-style presentation.

Initial dashboard modules:

- New users and role approvals
- Pending doctor consultations
- Prescriptions awaiting pharmacist verification
- Orders awaiting preparation
- Orders in fulfillment or delivery
- Payments pending review
- Low-stock inventory alerts
- Reported community content
- Recent patient and order activity
- Revenue or payment summary

Admin workflows:

- Add, edit, suspend, and review users
- Manage customer, doctor, pharmacist, and admin roles
- Create and manage products
- Manage product categories
- Review payments
- Manage inventory and stock adjustments
- Review consultations and prescriptions when permitted
- Moderate community posts, comments, and reports
- Search patients and orders quickly
- Export operational reports when needed

Current admin foundation:

- `/admin` is protected for admin sessions by middleware and a server-side admin guard.
- The first admin screen is a static operational overview for role approvals, pending consultations, payment review, prescriptions, orders, low stock, reported content, and recent audit activity.
- `/admin/users` reads Prisma users with doctor/pharmacist profiles when the database is available and shows a DB-offline empty state otherwise.
- Admin user approval Server Actions exist for approving doctor/pharmacist/admin roles and suspending users; inline success/error UX is still pending.
- Prisma now includes one-to-one `Doctor` and `Pharmacist` profile models linked to `User`, with staff approval status and license fields ready for data-backed workflows.
- Local seed data lives in `prisma/seed.mjs` and can populate the admin approval queue plus sample products, inventory, consultation, prescription, order, payment, shipment, moderation, notification, and reward records after the schema is pushed to a local MySQL database.
- Data-backed admin queues and management screens are still pending.

Local database setup for the current foundation:

1. Run `npm run db:up` to start the project-owned MySQL container `clinical-ethereality-db`.
2. Set `DATABASE_URL` in `.env.local` to `mysql://root:clinical_local_password@127.0.0.1:3307/clinical_ethereality`.
3. Run `npm run db:push` to apply the current Prisma schema.
4. Run `npm run db:seed` to create local development users and sample workflow records for the admin dashboard.
5. Use the local admin dev bypass on `/auth/line` when `ENABLE_DEV_AUTH_BYPASS=true`.

Design principles:

- Mobile-first only
- Persistent bottom navigation for primary app areas
- Teal as the primary color
- Consistent glassmorphism treatment for core surfaces
- Real photography preferred over illustrations
- Dense but calm information layout
- Clear status indicators
- Minimal decorative UI
- Strong empty states
- Accessible keyboard-friendly controls
- Avoid cluttered layouts
- Avoid unnecessary modal popups
- Minimize admin steps for common workflows
- No sensitive details exposed in notification previews or public routes

## UX Rules

- Mobile-first only: all primary workflows should be designed for phone screens before desktop expansion.
- Avoid cluttered layouts: prioritize one clear action per screen and progressive disclosure for secondary details.
- Keep footer navigation persistent and consistent exactly as defined in Stitch.
- Use Stitch glassmorphism consistently with the specified contrast, blur, border, and surface tokens.
- Use Stitch color tokens, including teal treatment where Stitch defines it.
- Prefer real photography over illustrations when Stitch calls for imagery.
- Avoid unnecessary modal popups: prefer Stitch-defined inline editing, dedicated screens, bottom sheets, or drawers.
- Minimize admin steps: common admin tasks should require the fewest safe number of taps.

## Deployment Strategy

Recommended environments:

- local: developer machine
- preview: automatic deployment per pull request or branch
- staging: production-like validation environment
- production: live customer, clinical, pharmacy, and admin environment

Recommended hosting:

- App: Vercel
- Database: managed MySQL provider compatible with Prisma and Vercel deployment
- File storage: Cloudinary or S3-compatible provider
- Monitoring: Sentry
- Analytics: privacy-conscious product analytics, added only when needed

Deployment requirements:

- Environment variables stored outside git
- Database migrations run through controlled deployment workflow
- Preview deployments use non-production data
- Production has backups enabled before launch
- Error monitoring enabled before patient onboarding
- Access logs and audit logs reviewed as part of compliance planning

Deployment runbook:

- See `DEPLOYMENT.md` for the Vercel preview, staging, and production readiness checklist.
- See `STAGING.md` and `.env.staging.example` for the staging environment setup checklist.
- See `PRODUCTION.md` and `.env.production.example` for the production environment launch gates.
- See `BACKUPS.md` for database and object-storage backup and restore procedures.
- Hosted preview deployments must keep `ENABLE_DEV_AUTH_BYPASS=false` and use non-production LINE, database, payment, storage, and video credentials.

## Non-Goals For Now

- Do not generate the full app yet
- Do not fully automate payments until the order and payment review workflow is defined
- Do not add AI features until the data model and access controls are stable
- Do not treat compliance as a final polish task

## Current Status

Planning and architecture documents have been created, and frontend implementation has started. The repo now has a Next.js 15, React 19, TypeScript, and Tailwind CSS foundation with shared customer footer navigation for `Consult | Store | Community | Profile`.

The current implementation is intentionally frontend-only. The customer Consult flow has been mocked from Figma/Stitch references from doctor list through advice log, but it does not include authentication, Prisma domain models, real booking, real payment verification, Zoom SDK, or admin scheduling yet.

Implemented Consult routes:

- `/consult`
- `/consult/booking/somchai`
- `/consult/payment`
- `/consult/waiting-room`
- `/consult/live`
- `/consult/advice-log`

Implemented Store routes:

- `/store`
- `/store/paracetamol-500mg`
- `/store/checkout`
- `/store/payment-success`

Implemented Community/Profile routes:

- `/community`
- `/community/search`
- `/community/create`
- `/community/vitamin-c-tips`
- `/notifications`
- `/profile`

Quality checks:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit` for permission helper unit coverage.
- `npx prisma validate`
- `npm run build`
- `npm run test:e2e` for Playwright smoke coverage of core customer and staff routes on a mobile viewport.
