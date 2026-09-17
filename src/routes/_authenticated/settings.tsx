import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Social Lab Growth Hub" },
      { name: "description", content: "Targets, assumptions, price points, lists, team and integrations." },
      { property: "og:title", content: "Settings — Social Lab Growth Hub" },
      { property: "og:description", content: "Targets and assumptions for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});
