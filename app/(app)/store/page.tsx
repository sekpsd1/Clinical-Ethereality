import { StitchedScreenPlaceholder } from "@/components/ui/StitchedScreenPlaceholder";

export default function StorePage() {
  return (
    <StitchedScreenPlaceholder
      eyebrow="Store"
      title="Health marketplace"
      description="Marketplace, product detail, checkout, payment success, and tracking will be composed from reviewed Stitch screens."
      statusItems={["Products", "Prescription notice", "Checkout", "Tracking"]}
    />
  );
}
