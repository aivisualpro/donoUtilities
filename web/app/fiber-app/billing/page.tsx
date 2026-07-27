import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { BillingContent } from "./content";

export const metadata = { title: "Billing — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <BillingContent />
      </Suspense>
    </FaPage>
  );
}
