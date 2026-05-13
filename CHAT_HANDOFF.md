# Clinical Ethereality Handoff

Use this file when starting a new chat because the previous context is nearly full.

## Latest State

- Repository: `C:\Projects\clinical-ethereality`
- Branch: `main`
- Latest pushed commit: `Build community search results screen`
- Implementation status: frontend-only static mock UI from Stitch/Figma references
- Stack: Next.js 15, React 19, TypeScript, Tailwind CSS, lucide-react
- Shared customer footer navigation: `Consult | Store | Community | Profile`
- Latest local dev URL: `http://localhost:3001`

## Completed Work

### Project Foundation

- Next.js 15 + React 19 + TypeScript strict mode scaffold
- Tailwind CSS setup
- Prisma placeholder schema
- ESLint/build/typecheck scripts
- Customer route group: `app/(app)`
- Shared app shell:
  - `components/layout/AppShell.tsx`
  - `components/layout/TopAppBar.tsx`
  - `components/navigation/FooterNav.tsx`
- Design-system foundation:
  - `lib/design-system/tokens.ts`
  - `lib/design-system/variants.ts`
  - `lib/design-system/component-contracts.ts`

### Consult Frontend Flow

Implemented routes:

- `/consult`
- `/consult/booking/somchai`
- `/consult/payment`
- `/consult/waiting-room`
- `/consult/live`
- `/consult/advice-log`

Notes:

- Consult flow is complete as static UI.
- No real booking, slot locking, payment verification, Zoom SDK, or backend data yet.

### Store Frontend Flow

Implemented routes:

- `/store`
- `/store/paracetamol-500mg`
- `/store/checkout`
- `/store/payment-success`

Implemented components:

- `features/products/HealthMarketplace.tsx`
- `features/products/ProductDetail.tsx`
- `features/products/StoreCheckout.tsx`
- `features/products/PaymentSuccessTracking.tsx`

Notes:

- Store Stitch flow is complete as static UI.
- CTA path connects marketplace -> product detail -> checkout -> payment success.
- Product/media visuals are local CSS-controlled visuals instead of remote Stitch image URLs to avoid browser scaling issues.
- Payment QR currently uses local placeholder assets from `public/images/payments`.

### Community/Profile Frontend Flow

Implemented routes:

- `/profile`
- `/community`
- `/community/search`
- `/community/create`
- `/community/vitamin-c-tips`
- `/notifications`

Implemented components:

- `features/profile/UserProfile.tsx`
- `features/community/CommunityHub.tsx`
- `features/community/CommunitySearchResults.tsx`
- `features/community/CreatePost.tsx`
- `features/community/ArticleDetail.tsx`
- `features/notifications/NotificationCenter.tsx`

Notes:

- Profile, Community Hub, Community Search Results, Create Post, Article Detail/Comments, and Notification Center are complete as static UI.
- Community Hub feed card links to `/community/vitamin-c-tips`.
- Community Hub search entry links to `/community/search`.
- Profile header has notification entry to `/notifications`.
- Notification Center is a sub-screen, not a root footer tab.

## Still Not Done

### Backend/Auth/Data

- LINE LIFF login
- JWT issuing, validation, refresh, and session handling
- Route protection and role-based access control
- Prisma domain models and migrations
- Seed data
- Server Actions conventions and implementation
- Zod validation schemas
- Domain services and query files
- Permission helpers

### Consult Backend

- Doctor availability model
- Admin schedule editor
- Slot locking
- Booking Server Actions
- Real appointment records
- Zoom SDK integration
- Live consultation real session state

### Commerce Backend

- Product catalog data model
- Inventory
- Orders and order items
- Payment records
- Thai QR generation
- Slip upload
- Slip Verification API integration
- Admin payment review
- Shipment tracking persistence

### Community Backend

- Articles/posts
- Comments
- Likes
- Reports and moderation
- Notifications persistence
- Reward points

### Admin/Pharmacist/Doctor Back Office

- Admin dashboard
- Doctor dashboard
- Pharmacist prescription queue
- Prescription writing
- Prescription verification
- Medicine preparation workflow
- Order status update workflows

### Quality/Testing/Deployment

- Unit tests
- Component tests
- Playwright smoke tests
- CI setup
- Vercel preview/staging/production config
- Monitoring/error tracking
- Compliance and vendor decisions

## Important Constraints

- Follow `AGENTS.md`.
- Do not redesign finalized Stitch screens.
- Keep routes thin; put screen logic/components in `features/*`.
- Preserve shared `FooterNav` labels exactly: `Consult | Store | Community | Profile`.
- Payment and checkout screens keep the parent flow active tab.
- Live consultation should hide footer navigation.
- Notification Center is a sub-screen, not a root footer tab.
- Treat patient data, prescriptions, payments, orders, images, and attachments as sensitive.
- Ask before architecture changes.
- If architecture changes are approved, document the reason in `PROJECT_STATE.md`.

## Known Caveats

- All implemented screens are static mock UI.
- Some older Thai strings in generated source files may show mojibake because earlier Stitch exports were copied from encoded HTML output.
- Several custom screens use full-canvas headers from Stitch references instead of the global `TopAppBar`.
- Running `next build` while `next dev` is active can corrupt `.next` dev chunks on this Windows setup.
- After `npm run build`, stop dev server, delete `.next`, then restart:

```powershell
npm run dev -- -p 3001
```

## Verification Commands

Run before handoff/completion:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Latest known verification before this handoff:

- `npm run lint` passed
- `npx tsc --noEmit` passed
- `npm run build` passed
- Dev route checks returned `HTTP 200` for latest implemented pages

## Recommended Next Step

Recommended backend path after reviewed static Stitch screens:

1. Start auth/session foundation: LINE LIFF + JWT + permission helpers.
2. Then Prisma domain schema.
3. Then make Consult doctor availability/admin scheduling data-driven.

## Prompt For New Chat

Copy this into the new chat:

```txt
Read AGENTS.md, PROJECT_STATE.md, TASKS.md, README.md, and CHAT_HANDOFF.md first.
Continue from commit b0c6e49.
Consult, Store, Profile, Community Hub, Community Search Results, Create Post, Article Detail, and Notification Center frontend screens are implemented as static Stitch UI.
The reviewed static Stitch customer screens are complete unless I ask you to revise one before starting backend auth, doctor availability, or admin scheduling.
```
