import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, EyeOff, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAllListItems,
  useCreateListItem,
  useReorderListItems,
  useUpdateListItem,
  type ListItem,
  type ListName,
} from "@/hooks/use-data";

const LISTS: { list: ListName; label: string }[] = [
  { list: "channel", label: "Channels" },
  { list: "service_line", label: "Service lines" },
  { list: "tier", label: "Tiers" },
  { list: "role", label: "Roles" },
];

export function ListsTab() {
  const { data: items = [], isLoading } = useAllListItems();
  const grouped = useMemo(() => {
    const map: Record<string, ListItem[]> = {};
    for (const item of items) (map[item.list] ??= []).push(item);
    for (const key of Object.keys(map)) map[key]!.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [items]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading lists…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {LISTS.map(({ list, label }) => (
        <ListCard key={list} list={list} label={label} items={grouped[list] ?? []} />
      ))}
    </div>
  );
}

function ListCard({ list, label, items }: { list: ListName; label: string; items: ListItem[] }) {
  const create = useCreateListItem();
  const updateItem = useUpdateListItem();
  const reorder = useReorderListItems();
  const [value, setValue] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const add = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    create.mutate(
      { list, value: trimmed, sort_order: nextOrder, active: true },
      {
        onSuccess: () => {
          setValue("");
          toast.success(`Added ${trimmed}`);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...items];
    const from = next.findIndex((i) => i.id === dragId);
    const to = next.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setDragId(null);
    reorder.mutate(
      next.map((item, index) => ({ id: item.id, sort_order: index })),
      { onError: (error) => toast.error(error.message) },
    );
  };

  const saveRename = () => {
    if (!renaming) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    updateItem.mutate(
      { id: renaming.id, patch: { value: trimmed } },
      {
        onSuccess: () => {
          toast.success(`Renamed to ${trimmed}`);
          setRenaming(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(item.id)}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
              <span className={item.active ? "text-sm" : "text-sm text-muted-foreground line-through"}>{item.value}</span>
              {!item.active ? (
                <Badge variant="secondary" className="ml-1">
                  Inactive
                </Badge>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Rename ${item.value}`}
                  onClick={() => {
                    setRenaming(item);
                    setRenameValue(item.value);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={item.active ? `Deactivate ${item.value}` : `Reactivate ${item.value}`}
                  onClick={() =>
                    updateItem.mutate(
                      { id: item.id, patch: { active: !item.active } },
                      { onError: (error) => toast.error(error.message) },
                    )
                  }
                >
                  {item.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </li>
          ))}
          {!items.length ? <li className="text-sm text-muted-foreground">Nothing here yet.</li> : null}
        </ul>
        <div className="flex gap-2">
          <Input
            value={value}
            placeholder={`Add a ${label.toLowerCase().replace(/s$/, "")}`}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <Button onClick={add} disabled={create.isPending}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </CardContent>

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename “{renaming?.value}”</DialogTitle>
            <DialogDescription className="flex items-start gap-2 text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Warning: past entries keep the old name. Only new records use the new one.</span>
            </DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={saveRename} disabled={updateItem.isPending}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
