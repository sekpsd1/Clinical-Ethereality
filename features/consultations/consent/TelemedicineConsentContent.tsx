import {
  TELEMEDICINE_CONSENT_DOCUMENT_SUBTITLE,
  TELEMEDICINE_CONSENT_DOCUMENT_TITLE,
  telemedicineConsentFinalChoices,
  telemedicineConsentSections,
  telemedicineCurrentRecordingDisclosure
} from "@/features/consultations/consent/content";

export function TelemedicineConsentContent({ titleId }: { titleId?: string }) {
  return (
    <div className="space-y-6 text-sm leading-7 text-[#3e494a]">
      <header>
        <h2 id={titleId} className="text-lg font-extrabold leading-7 text-[#191c1e]">
          {TELEMEDICINE_CONSENT_DOCUMENT_TITLE}
        </h2>
        <p className="mt-1 font-semibold text-[#616363]">{TELEMEDICINE_CONSENT_DOCUMENT_SUBTITLE}</p>
      </header>

      {telemedicineConsentSections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="font-extrabold text-[#191c1e]">{section.title}</h3>
          {section.blocks.map((block, index) => {
            if (block.kind === "subheading") {
              return <h4 key={`${section.title}-${index}`} className="pt-1 font-bold text-[#191c1e]">{block.text}</h4>;
            }

            if (block.kind === "item") {
              return <p key={`${section.title}-${index}`} className="pl-3">{block.text}</p>;
            }

            return <p key={`${section.title}-${index}`}>{block.text}</p>;
          })}
        </section>
      ))}

      <section className="space-y-2" aria-labelledby="telemedicine-consent-source-choices">
        <h3 id="telemedicine-consent-source-choices" className="font-extrabold text-[#191c1e]">
          รายการยืนยันในแบบฟอร์มต้นฉบับ
        </h3>
        {telemedicineConsentFinalChoices.map((choice) => (
          <p key={choice} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-px text-base text-primary">☐</span>
            <span>{choice}</span>
          </p>
        ))}
      </section>

      <section className="space-y-2 border-t border-primary/20 pt-5" aria-labelledby="telemedicine-current-recording-disclosure">
        <h3 id="telemedicine-current-recording-disclosure" className="font-extrabold text-primary">
          {telemedicineCurrentRecordingDisclosure.title}
        </h3>
        <p>{telemedicineCurrentRecordingDisclosure.body}</p>
      </section>
    </div>
  );
}
