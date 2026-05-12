# Client Intake Checklist

This checklist tracks information needed from the client before implementation and production launch. Keep sensitive values such as API keys, tax IDs, bank details, and personal documents out of git; record only whether they have been received and where they are stored securely.

## Part 1: Foundation And Corporate

### Legal And Corporate Data

- [ ] Thai Privacy Policy aligned with PDPA
- [ ] Thai Terms of Service
- [ ] Cookie or tracking notice, if analytics or marketing pixels are used
- [ ] Consent text for collecting health-related information
- [ ] Consent text for teleconsultation
- [ ] Consent text for prescriptions and pharmacy fulfillment
- [ ] Refund and cancellation policy
- [ ] Shipping and delivery policy
- [ ] Community guidelines and moderation policy

### Company Data

- [ ] Legal company name
- [ ] Tax ID
- [ ] Registered office address
- [ ] Billing address, if different from registered address
- [ ] Parcel sender name and address
- [ ] Customer support email
- [ ] Customer support phone or LINE Official Account
- [ ] Official logo and brand assets

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

- [ ] Pharmacy legal name
- [ ] Pharmacy license number
- [ ] Pharmacist full legal name
- [ ] Pharmacist license number
- [ ] Prescription verification SOP
- [ ] Medicine preparation SOP
- [ ] Packing and shipment SOP
- [ ] Controlled item restrictions, if any

### Payment And Integration

- [ ] PromptPay phone number or tax ID linked to payment account
- [ ] Bank account name
- [ ] Bank name
- [ ] Bank account number, stored securely outside git
- [ ] SlipOK or EasySlip provider choice
- [ ] Slip verification API key, stored securely outside git
- [ ] Slip verification webhook details, if supported
- [ ] Payment success and rejection handling rules

### Shipping

- [ ] Supported delivery providers
- [ ] Shipping fee rules
- [ ] Free shipping rules
- [ ] Delivery coverage area
- [ ] Estimated delivery windows
- [ ] Tracking number format or carrier integration plan

## Part 4: Community Hub

### Article Content

- [ ] Original health articles from doctors or pharmacists
- [ ] Article cover images
- [ ] Article categories, such as allergy, skin health, supplements, general health
- [ ] Verified content criteria
- [ ] Author display rules

### Community Rules

- [ ] Discussion board rules
- [ ] Prohibited content rules
- [ ] Medical disclaimer for community posts
- [ ] Report content reasons
- [ ] Moderation workflow
- [ ] Admin escalation process
- [ ] User suspension or ban rules

## Technical Access Needed Later

- [ ] LINE Developers account access
- [ ] LINE LIFF ID
- [ ] LINE channel ID and secret
- [ ] Vercel project access
- [ ] Managed MySQL access
- [ ] Cloudinary or S3 credentials
- [ ] Zoom SDK credentials
- [ ] Email provider credentials
- [ ] SMS provider credentials, if SMS is used
- [ ] Sentry or monitoring credentials

## Recommended Priority

Before development starts:

1. Privacy Policy, Terms of Service, and health data consent direction
2. Company name, tax ID, billing/shipping address, and support contact
3. Doctor profile, license, price, schedule, and official photo
4. Product catalog with FDA numbers, prices, images, and prescription requirements
5. PromptPay account and SlipOK/EasySlip provider decision
6. Community categories and moderation rules
7. Stitch source files or token export for exact UI implementation
