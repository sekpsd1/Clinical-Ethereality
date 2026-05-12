import { StitchedScreenPlaceholder } from "@/components/ui/StitchedScreenPlaceholder";

export default function ConsultPage() {
  return (
    <StitchedScreenPlaceholder
      eyebrow="Consult"
      title="Doctor list"
      description="Stitch-priority consult flow starts here: doctor list, booking, PromptPay checkout, waiting room, live consultation, and advice log."
      statusItems={["Doctors", "Booking", "Payment", "Advice log"]}
    />
  );
}
