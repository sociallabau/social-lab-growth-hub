import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MinusCircle, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAllTeamMembers, useIsTeamAdmin, useSaveTeamMember, useUpdateTeamMember } from "@/hooks/use-data";
import { formatDate } from "@/lib/format";

const ROLES = ["admin", "member"] as const;

export function TeamTab() {
  const { data: members = [], isLoading } = useAllTeamMembers();
  const { data: isAdmin = false } = useIsTeamAdmin();
  const save = useSaveTeamMember();
  const updateMember = useUpdateTeamMember();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("member");

  const add = () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    save.mutate(
      { email: trimmed, full_name: name.trim() || null, role, active: true },
      {
        onSuccess: () => {
          setEmail("");
          setName("");
          toast.success(`${trimmed} added to the team list`);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading team…</p>;

  return (
    <div className="space-y-4">
      {!isAdmin ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Only admins can add people, change a role or deactivate an account.
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team list</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.email}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>{member.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      disabled={!isAdmin || updateMember.isPending}
                      onValueChange={(value) =>
                        updateMember.mutate(
                          { email: member.email, patch: { role: value } },
                          {
                            onSuccess: () => toast.success(`${member.email} is now ${value}`),
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {member.active ? (
                      <Badge className="gap-1 bg-good-soft text-good">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <MinusCircle className="size-3.5" aria-hidden /> Deactivated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(member.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isAdmin || updateMember.isPending}
                      onClick={() =>
                        updateMember.mutate(
                          { email: member.email, patch: { active: !member.active } },
                          {
                            onSuccess: () =>
                              toast.success(member.active ? `${member.email} deactivated` : `${member.email} reactivated`),
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                    >
                      {member.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" aria-hidden /> Add someone
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="team-email">Email</Label>
              <Input id="team-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@sociallab.com.au" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Name</Label>
              <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4">
              <Button onClick={add} disabled={save.isPending}>
                <Plus className="size-4" /> Add to team list
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
