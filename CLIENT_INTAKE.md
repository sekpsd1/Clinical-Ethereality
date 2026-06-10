# Client Intake Checklist

This checklist tracks information needed from the client before implementation and production launch. Keep sensitive values such as API keys, tax IDs, bank details, and personal documents out of git; record only whether they have been received and where they are stored securely.

## Part 1: Foundation And Corporate

### Legal And Corporate Data

- [x] Thai Privacy Policy aligned with PDPA: draft received; use current draft for now and expect later revisions
- [x] Thai Terms of Service: draft received; use current draft for now and expect later revisions
- [ ] Cookie or tracking notice, if analytics or marketing pixels are used
- [x] Consent text for collecting health-related information: received
- [x] Consent text for teleconsultation: received
- [x] Consent text for prescriptions and pharmacy fulfillment: received
- [x] Refund and cancellation policy: draft terms received; use current draft for now and expect later revisions
- [x] Shipping and delivery policy: draft shipping rules received; use current draft for now and expect later revisions
- [ ] Community guidelines and moderation policy

### Company Data

- [x] Legal company name: received
- [x] Tax ID: received; keep exact value out of public docs and git history
- [x] Registered office address: received
- [x] Billing address, if different from registered address: received
- [x] Parcel sender name and address: received
- [x] Customer support email: received
- [x] Customer support phone or LINE Official Account: received
- [x] Official logo and brand assets: two company logos received as `LOGO cytogenetics.png` and `logo clinic.png`; use `logo clinic.png` as the clinic/pharmacy reference logo for documents and system references, and do not require a separate web app logo for the current UI scope

## Part 2: Consultation System

### Physician Onboarding

- [x] Doctor full legal name: received; keep exact identity/license documents out of git
- [x] Display name and title: received
- [x] Professional bio: received
- [x] Education history: received
- [x] Specialty and expertise: received
- [x] Medical license number: received; keep exact value out of git
- [x] License verification document or image: received as local `461135.jpg`; keep the document and exact values outside git
- [x] Official profile photo in realistic/medical style: received
- [x] Consultation fee: received
- [x] Consultation duration: received
- [x] Available consultation schedule: received
- [x] Supported consultation modes, such as video, chat, or both: received
- [ ] Cancellation and rescheduling rules
- [x] Prescription workflow rules after consultation: client says doctors prescribe directly from the clinic; if a product requires a prescription, the customer can attach the prescription and purchase in the system without an additional document-review step after attachment.

### Consultation Operations

- [ ] Final pre-doctor consult assessment recommendation mapping with real doctor data; all 4 Stitch export pages, persistence, 7-day reuse, booking attachment, and doctor-visible summary are implemented
- [ ] Zoom SDK account details
- [ ] Consultation reminder timing
- [ ] Waiting room timing rules
- [ ] Doctor late/no-show handling
- [ ] Patient no-show handling
- [ ] Advice log template
- [ ] Prescription PDF template

## Part 3: Commerce And Pharmacy

### Product Catalog

- [x] Product name: received for HPV urine kit, HPV self swab kit, STIs urine kit, and STIs self swab kit/package combinations
- [x] Product category: received
- [x] Product description and usage instructions: received
- [ ] FDA number: pending; client marked FDA as in progress
- [x] Unit price, including VAT handling if applicable: received; exact package pricing should be entered into seed/catalog data only after review
- [x] Product images using real medical-standard photography: received
- [x] Prescription-required flag: received; current kits can be purchased without prescription
- [x] Stock quantity: received
- [x] Low stock threshold: received
- [x] Contraindications or warnings, if applicable: received
- [x] Storage instructions, if applicable: received

### Pharmacy Data

- [x] Pharmacy legal name: use `บางกอก ไซโตเจเนติกซ์` for clinic/pharmacy display in pharmacy workflows
- [x] Pharmacy/clinic license direction: client says the clinic is used as the pharmacy/dispensing storefront, with doctors prescribing directly; products that require prescriptions can be purchased after attaching the prescription. Received facility-license document image, exact value stays outside git.
- [ ] Pharmacist full legal name: not provided; client says no additional document-review step is needed after prescription attachment, so confirm whether pharmacist role remains needed for MVP fulfillment operations only
- [ ] Pharmacist license number: not provided; client says no additional document-review step is needed after prescription attachment, so confirm whether pharmacist role remains needed for MVP fulfillment operations only
- [x] Prescription verification SOP: drafted for client review in `PHARMACY_SOP_DRAFT.md`
- [x] Medicine preparation SOP: drafted for client review in `PHARMACY_SOP_DRAFT.md`
- [x] Packing and shipment SOP: drafted for client review in `PHARMACY_SOP_DRAFT.md`
- [ ] Controlled item restrictions, if any

### Payment And Integration

- [x] PromptPay phone number or tax ID linked to payment account: received; keep exact value outside git and configure through `THAI_QR_PROMPTPAY_ID`
- [x] Bank account name: received
- [x] Bank name: received
- [x] Bank account number, stored securely outside git: received; do not commit the exact value
- [x] SlipOK or EasySlip provider choice: EasySlip selected
- [ ] Slip verification API key, stored securely outside git: owner-managed EasySlip setup
- [ ] Slip verification webhook details, if supported: owner-managed EasySlip setup
- [x] Payment success and rejection handling rules: received for accepted/rejected slips, duplicate slips, mismatched amount, wrong account, expired slips, retry lockout, customer notification, and audit logging

### Shipping

- [x] Supported delivery providers: received
- [x] Shipping fee rules: received
- [ ] Free shipping rules: deferred; do not ask the client unless the shipping policy changes
- [x] Delivery coverage area: received
- [x] Estimated delivery windows: received
- [x] Tracking number format or carrier integration plan: received as tracking-number based workflow

## Part 4: Community Hub

### Article Content

- [ ] Original health articles from doctors or pharmacists: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Article cover images: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Article categories, such as allergy, skin health, supplements, general health: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Verified content criteria: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Author display rules: deferred until after MVP unless the client asks to launch Community earlier

### Community Rules

- [ ] Discussion board rules: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Prohibited content rules: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Medical disclaimer for community posts: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Report content reasons: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Moderation workflow: deferred until after MVP unless the client asks to launch Community earlier
- [ ] Admin escalation process: deferred until after MVP unless the client asks to launch Community earlier
- [ ] User suspension or ban rules: deferred until after MVP unless the client asks to launch Community earlier

## Technical Access Needed Later

- [ ] LINE Developers account access
- [ ] LINE LIFF ID
- [ ] LINE channel ID and secret
- [ ] Vercel project access
- [ ] Managed MySQL access
- [ ] Cloudinary or S3 credentials
- [ ] Zoom SDK credentials
- [ ] Email provider credentials
- [ ] Sentry or monitoring credentials

## Owner-Managed Setup Notes

- LINE LIFF channel setup will be handled by the project owner for the client.
- Zoom SDK credential setup will be handled by the project owner for the client.
- File storage credential setup, such as Cloudinary or S3-compatible storage, will be handled by the project owner for the client.
- EasySlip API key and webhook setup will be handled by the project owner for the client.
- Stitch source, tokens, and assets are owner-managed design inputs, not client intake. If additional screens are needed, the project owner will provide Stitch HTML exports.

## Intake Templates Prepared

- `DOCTOR_INTAKE_TEMPLATE.md`: doctor profile, license, consultation schedule, consultation mode, and policy fields.
- `CONSULT_ASSESSMENT_INTAKE_TEMPLATE.md`: pre-doctor assessment flow, question schema, routing logic, privacy, and Stitch export requirements.
- `PRODUCT_CATALOG_TEMPLATE.csv`: product catalog fields for FDA number, price, VAT note, image file names, prescription requirement, stock, warnings, and storage.
- `PHARMACIST_INTAKE_TEMPLATE.md`: pharmacy license, pharmacist license, controlled item, substitution, shipment exception, and document-template policy fields.
- `CLIENT_SOP_REVIEW_MESSAGE.md`: owner-facing LINE/email copy for asking the client to review the pharmacy SOP.

## Latest Client Intake Gap Summary

Received from the client:

- Draft Thai PDPA Privacy Policy and Terms of Service, including refund/cancellation and shipping terms.
- Health-data consent, teleconsultation consent, and prescription/pharmacy fulfillment consent wording.
- Company identity, registered/billing/sender address, support email, phone, and LINE OA.
- Two company/clinic logo image files received; use `logo clinic.png` for clinic/pharmacy references, with no separate web app logo required in the current UI scope.
- Bank account holder and bank details, with sensitive exact account values to remain outside git.
- Production PromptPay identifier received; exact value must remain outside git and be configured only through environment secrets.
- EasySlip selected as the slip verification provider.
- Payment review outcomes and rejection handling rules.
- Thailand Post EMS shipping rules, delivery coverage, delivery windows, and tracking-number workflow.
- Client confirmed the clinic will be used as the pharmacy/storefront concept.
- Draft pharmacy/prescription fulfillment SOP and client review message are prepared for owner review before sending to the client.
- Doctor, product catalog, and pharmacist/pharmacy intake templates are prepared for the owner to send to the client.
- Client intake bundle received from Google Drive download on 2026-06-08 and reviewed from local path outside the repo. It includes one doctor telemedicine profile, official doctor photo, home-test product catalog details, product images, clinic/facility license document image, payment/bank reference document, and corporate/certification images. Sensitive exact values and personal/license documents must remain outside git.
- Doctor telemedicine data received for one physician, including display/legal name, bio, education, specialty, license number, consultation fee, 15-minute duration, weekday evening schedule, and video/chat support. The physician license number and documents are not committed.
- Product catalog data received for HPV urine kit, HPV self swab kit, STIs urine kit, and STIs self swab kit/package combinations, including category, usage instructions, package pricing/VAT note, non-prescription purchase flag, stock, low-stock threshold, warnings, storage instructions, and product images. FDA numbers are still pending because the client marked them as in progress.
- Clinic-as-pharmacy direction updated: client says medicines are dispensed directly through the clinic by the doctor, and prescription-required medicines can be purchased by attaching a prescription in the system without an additional document-review step after attachment. The in-app doctor-issued prescription path now supports direct prescription-required ordering without a pharmacist verification gate; external prescription attachment metadata now supports owner-managed storage URLs without storing file bytes in the database.
- Pre-doctor assessment flow rules received: 4 Stitch-designed pages, follow Stitch answer types, recommend by assessment topic while allowing doctor selection, reuse assessment for 7 days, show answers to doctors, and no file/image attachment in the first version.
- Pre-doctor assessment intro Stitch export received and implemented as `/consult/assessment`.
- Pre-doctor assessment symptom Stitch export received and implemented as `/consult/assessment/symptoms`.
- Pre-doctor assessment duration Stitch export received and implemented as `/consult/assessment/duration`.
- Pre-doctor assessment completion Stitch export received and implemented as `/consult/assessment/complete`; answer persistence, 7-day reuse, booking attachment, doctor-visible answers, real-doctor recommendation mapping, `/consult?recommended=assessment` handoff, and recommended doctor highlighting are implemented.
- Client/owner direction clarified that consultation chat must be an in-app chat separate from LINE. The first foundation is implemented with Prisma/MySQL consultation messages, access checks, audit logs, in-app notifications, live consult UI binding, and latest-message visibility for doctors; Firebase or another realtime provider is not selected yet.
- Admin compliance now includes an owner-managed integration readiness panel for PromptPay/payment webhook, SlipOK/EasySlip, storage, LINE LIFF, and Zoom environment variables; it reports only configured/missing keys and does not expose secret values.

Still needed from the client:

- Later legal review or revised legal drafts, if the client updates the current wording.
- Community guidelines, article content, and moderation policy are deferred until after MVP unless the client asks to launch Community earlier.
- FDA numbers for the product catalog remain pending.
- Pharmacist name/license remain not provided because client says doctors prescribe directly from the clinic and no additional document-review step is needed after prescription attachment; confirm whether pharmacist role remains needed for MVP fulfillment operations before removing or reducing the prepared role workflow.
- File bytes for external prescription uploads still need Cloudinary or S3-compatible storage setup; the application metadata/order linkage foundation is implemented.
- Realtime chat provider decision remains open if the owner wants live push updates beyond the current persisted in-app chat foundation.
- Client review of the drafted pharmacy SOP in `PHARMACY_SOP_DRAFT.md`, using `CLIENT_SOP_REVIEW_MESSAGE.md` as the owner-facing send template; update the SOP for clinic-direct doctor prescribing, no-review prescription attachment purchases, controlled item restrictions, substitution rules, shipment exceptions, and prescription/label templates.

Still owner-managed:

- LINE LIFF channel configuration.
- Zoom SDK credentials.
- Cloudinary or S3-compatible file storage credentials.
- EasySlip API key and webhook details.
- Additional Stitch HTML exports if new screens are needed.
- Community content and moderation workflow, if Community is brought back into MVP scope.

## Recommended Priority

Before development starts:

1. Privacy Policy, Terms of Service, and health data consent direction
2. Company name, tax ID, billing/shipping address, and support contact
3. Run/review the updated local seed that maps the received doctor and product data without committing exact sensitive license values
4. Product catalog FDA numbers and final owner review of package pricing/catalog structure
5. Secure environment configuration for the received PromptPay account
6. Wire the selected Cloudinary or S3-compatible storage provider for actual file bytes; external prescription metadata/order linkage is implemented and the in-app doctor-issued prescription purchase path skips additional document review while preserving audit
7. Community categories and moderation rules only if Community is brought back into MVP scope
8. Additional owner-provided Stitch HTML exports if new screens are needed
