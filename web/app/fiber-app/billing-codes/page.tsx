import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { BillingCodesContent } from "./content";

export const metadata = { title: "Billing Codes — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <BillingCodesContent />
      </Suspense>
    </FaPage>
  );
}
