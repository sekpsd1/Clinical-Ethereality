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

- [ ] Doctor full legal name
- [ ] Display name and title
- [ ] Professional bio
- [ ] Education history
- [ ] Specialty and expertise
- [ ] Medical license number
- [ ] License verification document or image
- [ ] Official profile photo in realistic/medical style
- [ ] Consultation fee
- [ ] Consultation duration
- [ ] Available consultation schedule
- [ ] Supported consultation modes, such as video, chat, or both
- [ ] Cancellation and rescheduling rules
- [ ] Prescription workflow rules after consultation

### Consultation Operations

- [ ] Remaining pre-doctor consult assessment Stitch HTML export zip files; intro page and symptom page received and implemented at `/consult/assessment` and `/consult/assessment/symptoms`, flow rules received for 4 Stitch-designed pages, recommendation after completion, optional doctor selection, 7-day reuse, doctor visibility, and no attachment field
- [ ] Zoom SDK account details
- [ ] Consultation reminder timing
- [ ] Waiting room timing rules
- [ ] Doctor late/no-show handling
- [ ] Patient no-show handling
- [ ] Advice log template
- [ ] Prescription PDF template

## Part 3: Commerce And Pharmacy

### Product Catalog

- [ ] Product name
- [ ] Product category
- [ ] Product description and usage instructions
- [ ] FDA number
- [ ] Unit price, including VAT handling if applicable
- [ ] Product images using real medical-standard photography
- [ ] Prescription-required flag
- [ ] Stock quantity
- [ ] Low stock threshold
- [ ] Contraindications or warnings, if applicable
- [ ] Storage instructions, if applicable

### Pharmacy Data

- [x] Pharmacy legal name: use `บางกอก ไซโตเจเนติกซ์` for clinic/pharmacy display in pharmacy workflows
- [ ] Pharmacy license number: still needed for the clinic-as-pharmacy workflow
- [ ] Pharmacist full legal name
- [ ] Pharmacist license number
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
- Pre-doctor assessment flow rules received: 4 Stitch-designed pages, follow Stitch answer types, recommend by assessment topic while allowing doctor selection, reuse assessment for 7 days, show answers to doctors, and no file/image attachment in the first version.
- Pre-doctor assessment intro Stitch export received and implemented as `/consult/assessment`; remaining assessment pages are still needed before the full assessment flow can replace the temporary doctor-list continuation.
- Pre-doctor assessment symptom Stitch export received and implemented as `/consult/assessment/symptoms`; remaining assessment pages are still needed before recommendation routing and 7-day reuse can be completed.

Still needed from the client:

- Later legal review or revised legal drafts, if the client updates the current wording.
- Community guidelines, article content, and moderation policy are deferred until after MVP unless the client asks to launch Community earlier.
- Doctor profiles, licenses, fees, schedules, and official photos.
- Remaining Stitch HTML export zip files for the pre-doctor assessment screens and final recommendation mapping labels from the Stitch design.
- Pharmacy license number, pharmacist name, and pharmacist license number for the clinic-as-pharmacy workflow.
- Product catalog with FDA numbers, prices, images, stock, prescription-required flags, warnings, and storage instructions.
- Client review of the drafted pharmacy SOP in `PHARMACY_SOP_DRAFT.md`, using `CLIENT_SOP_REVIEW_MESSAGE.md` as the owner-facing send template; confirm clinic-specific constraints, controlled item restrictions, substitution rules, shipment exceptions, and prescription/label templates.

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
3. Doctor profile, license, price, schedule, and official photo
4. Product catalog with FDA numbers, prices, images, and prescription requirements
5. Secure environment configuration for the received PromptPay account
6. Client review of the drafted pharmacy and fulfillment SOP, including any clinic-specific constraints
7. Community categories and moderation rules only if Community is brought back into MVP scope
8. Additional owner-provided Stitch HTML exports if new screens are needed
