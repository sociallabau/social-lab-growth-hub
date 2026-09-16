import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PlaceholderCard } from "@/components/shell/page-header";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Social Lab Growth Hub" },
      { name: "description", content: "Targets, assumptions, price points and editable lists." },
      { property: "og:title", content: "Settings — Social Lab Growth Hub" },
      { property: "og:description", content: "Targets and assumptions for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Targets, assumptions, price points and lists." />
      <PlaceholderCard text="Settings will appear here." />
    </>
  );
}
