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
- [ ] Prescription verification SOP
- [ ] Medicine preparation SOP
- [ ] Packing and shipment SOP
- [ ] Controlled item restrictions, if any

### Payment And Integration

- [ ] PromptPay phone number or tax ID linked to payment account: needed for generated PromptPay QR payloads
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

## Latest Client Intake Gap Summary

Received from the client:

- Draft Thai PDPA Privacy Policy and Terms of Service, including refund/cancellation and shipping terms.
- Health-data consent, teleconsultation consent, and prescription/pharmacy fulfillment consent wording.
- Company identity, registered/billing/sender address, support email, phone, and LINE OA.
- Two company/clinic logo image files received; use `logo clinic.png` for clinic/pharmacy references, with no separate web app logo required in the current UI scope.
- Bank account holder and bank details, with sensitive exact account values to remain outside git.
- EasySlip selected as the slip verification provider.
- Payment review outcomes and rejection handling rules.
- Thailand Post EMS shipping rules, delivery coverage, delivery windows, and tracking-number workflow.
- Client confirmed the clinic will be used as the pharmacy/storefront concept.

Still needed from the client:

- Later legal review or revised legal drafts, if the client updates the current wording.
- Community guidelines, article content, and moderation policy are deferred until after MVP unless the client asks to launch Community earlier.
- Doctor profiles, licenses, fees, schedules, and official photos.
- Pharmacy license number, pharmacist name, and pharmacist license number for the clinic-as-pharmacy workflow.
- Product catalog with FDA numbers, prices, images, stock, prescription-required flags, warnings, and storage instructions.
- Clinic-specific pharmacy SOP constraints, if any; otherwise the project team will draft the prescription verification, medicine preparation, packing, and shipment flow for client review.
- PromptPay phone or tax ID for generated QR payment payloads.

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
5. PromptPay account for QR payment payloads
6. Clinic-specific SOP constraints, if any, before the project team drafts pharmacy and fulfillment workflows
7. Community categories and moderation rules only if Community is brought back into MVP scope
8. Additional owner-provided Stitch HTML exports if new screens are needed
