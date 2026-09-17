// Manual leads: phone calls and referrals that never hit the inbox.
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateLead, useListItems } from "@/hooks/use-data";
import { Plus } from "lucide-react";

function localNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const empty = {
  received_at: localNow(),
  name: "",
  company: "",
  email: "",
  phone: "",
  channel: "",
  tier: "",
  message: "",
  number_of_agents: "",
  monthly_marketing_budget: "",
};

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(empty);
  const lists = useListItems();
  const createLead = useCreateLead();

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (!draft.name && !draft.company) {
      toast.error("Add a name or a company");
      return;
    }
    try {
      await createLead.mutateAsync({
        source: "manual",
        status: "new",
        received_at: new Date(draft.received_at).toISOString(),
        name: draft.name || null,
        company: draft.company || null,
        email: draft.email || null,
        phone: draft.phone || null,
        channel: draft.channel || null,
        tier: draft.tier || null,
        message: draft.message || null,
        number_of_agents: draft.number_of_agents || null,
        monthly_marketing_budget: draft.monthly_marketing_budget || null,
      });
      toast.success("Lead added");
      setDraft({ ...empty, received_at: localNow() });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the lead");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" aria-hidden />
          Add lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>For phone calls and referrals. These skip the inbox and start as New.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="l-received">Received</Label>
            <Input id="l-received" type="datetime-local" value={draft.received_at} onChange={(e) => set("received_at", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-name">Name</Label>
            <Input id="l-name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-company">Company</Label>
            <Input id="l-company" value={draft.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-email">Email</Label>
            <Input id="l-email" type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-phone">Phone</Label>
            <Input id="l-phone" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={draft.channel} onValueChange={(v) => set("channel", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {(lists.data?.channel ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.value}>
                    {i.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tier</Label>
            <Select value={draft.tier} onValueChange={(v) => set("tier", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {(lists.data?.tier ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.value}>
                    {i.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-agents">Number of agents</Label>
            <Input id="l-agents" value={draft.number_of_agents} onChange={(e) => set("number_of_agents", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-budget">Monthly marketing budget</Label>
            <Input id="l-budget" value={draft.monthly_marketing_budget} onChange={(e) => set("monthly_marketing_budget", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="l-message">Message</Label>
            <Textarea id="l-message" rows={3} value={draft.message} onChange={(e) => set("message", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={createLead.isPending}>
            Save lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
