import { Suspense } from "react";
import { FaPage } from "@/components/fiber-app/fa-page";
import { PhotosContent } from "./content";

export const metadata = { title: "Photos — FiberApp" };

export default function Page() {
  return (
    <FaPage>
      <Suspense fallback={null}>
        <PhotosContent />
      </Suspense>
    </FaPage>
  );
}
