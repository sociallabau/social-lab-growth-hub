import { createFileRoute } from "@tanstack/react-router";
import { CapacityPage } from "@/components/capacity/capacity-page";

export const Route = createFileRoute("/_authenticated/capacity")({
  head: () => ({
    meta: [
      { title: "Capacity — Social Lab Growth Hub" },
      { name: "description", content: "Staff hours, packages, capacity by role and margin outlook." },
      { property: "og:title", content: "Capacity — Social Lab Growth Hub" },
      { property: "og:description", content: "Capacity planning for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CapacityPage,
});
