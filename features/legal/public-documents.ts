import { TELEMEDICINE_CONSENT_VERSION } from "@/features/consultations/consent/policy";

export const CANONICAL_APP_URL = "https://app.bccgroup-thailand.com";

export const clinicController = {
  name: "บางกอกไซโตเจเนติกซ์คลินิกเฉพาะทางด้านเวชกรรมสูตินรีเวช",
  address: "65/18 ซอยโชคชัยร่วมมิตร แขวงจอมพล เขตจตุจักร กรุงเทพมหานคร 10900",
  email: "info@bccgroup-thailand.com",
  phones: ["02-690-0063", "086-306-2084"]
} as const;

export const telemedicineConsentDocument = {
  version: TELEMEDICINE_CONSENT_VERSION,
  retentionYears: 5,
  automaticRecording: true
} as const;
