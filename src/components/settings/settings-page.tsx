import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssumptionsTab } from "@/components/settings/assumptions-tab";
import { ListsTab } from "@/components/settings/lists-tab";
import { TeamTab } from "@/components/settings/team-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Targets, assumptions, lists, team and integrations." />
      <Tabs defaultValue="assumptions">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="assumptions">Assumptions &amp; targets</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="assumptions">
          <AssumptionsTab />
        </TabsContent>
        <TabsContent value="lists">
          <ListsTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
