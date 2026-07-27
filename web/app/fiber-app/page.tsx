import { redirect } from "next/navigation";

/** FiberApp has no landing screen of its own — the dashboard is the entry point. */
export default function FiberAppIndex() {
  redirect("/fiber-app/dashboard");
}
