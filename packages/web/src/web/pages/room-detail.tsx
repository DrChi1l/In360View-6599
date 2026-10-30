import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  Save,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, Input, SectionTitle, Textarea } from "../components/ui/field";
import { EmptyState, ErrorNote, Loading } from "../components/empty-state";
import {
  ChangePill,
  CleanlinessPill,
  ConditionPill,
} from "../components/status-pill";
import {
  ChangeStatusPicker,
  CleanlinessPicker,
  ConditionPicker,
} from "../components/chip-picker";
import { PhotoGrid } from "../components/photo-grid";
import { SwipeRow } from "../components/swipe-row";
import { useReport } from "../queries/reports";
import { useAddItem, useRemoveItem, useSaveRoomBatch } from "../queries/inspection";
import { shortAddress } from "../lib/format";
import {
  CLEANLINESS_LABELS,
  CONDITION_LABELS,
  type ChangeStatus,
  type Cleanliness,
  type Condition,
} from "../../api/lib/domain";

type ItemDraft = {
  condition: string | null;
  cleanliness: string | null;
  description: string | null;
  notes: string | null;
  changeStatus: ChangeStatus | null;
};

const EMPTY_ITEM: ItemDraft = {
  condition: null,
  cleanliness: null,
  description: "",
  notes: "",
  changeStatus: null,
};

type RoomDraft = {
  condition: string | null;
  cleanliness: string | null;
  notes: string | null;
};

export default function RoomDetail({ reportId, roomId }: { reportId?: string; roomId?: string }) {
  const [, navigate] = useLocation();
  const id = reportId;
  const query = useReport(id);
  const save = useSaveRoomBatch(id);
  const addItem = useAddItem(id);
  const removeItem = useRemoveItem(id);

  const room = query.data?.rooms.find((r) => r.id === roomId);
  const report = query.data?.report;
  const locked = Boolean(report?.lockedAt);
  const isCheckOut = report?.type === "check_out";

  const [roomDraft, setRoomDraft] = useState<RoomDraft>({
    condition: null,
    cleanliness: null,
    notes: "",
  });
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Seed the local draft once the room arrives, and again after a refetch that
  // is not the result of our own edits.
  const signature = useMemo(
    () =>
      room
        ? [
            room.id,
            room.condition ?? "",
            room.cleanliness ?? "",
            room.notes ?? "",
            room.items.map((i) => i.id).join(","),
          ].join("|")
        : "",
    [room],
  );

  useEffect(() => {
    if (!room || dirty) return;
    setRoomDraft({
      condition: room.condition ?? null,
      cleanliness: room.cleanliness ?? null,
      notes: room.notes ?? "",
    });
    setItemDrafts(
      Object.fromEntries(
        room.items.map((item) => [
          item.id,
          {
            condition: item.condition ?? null,
            cleanliness: item.cleanliness ?? null,
            description: item.description ?? "",
            notes: item.notes ?? "",
            changeStatus: (item.changeStatus as ChangeStatus | null) ?? null,
          },
        ]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (query.isLoading) {
    return (
      <AppShell title="Room" back={id ? `/reports/${id}` : "/reports"}>
        <Loading />
      </AppShell>
    );
  }
  if (query.error || !query.data || !room || !report) {
    return (
      <AppShell title="Room" back={id ? `/reports/${id}` : "/reports"}>
        <ErrorNote error={query.error ?? new Error("Room not found.")} />
      </AppShell>
    );
  }

  const previousItems = query.data.previousItems;
  const photosByItem: Record<string, number> = {};
  for (const photo of query.data.photos) {
    if (photo.itemId) photosByItem[photo.itemId] = (photosByItem[photo.itemId] ?? 0) + 1;
  }
  const scored = room.items.filter((item) => {
    const draft = itemDrafts[item.id];
    return Boolean(draft?.condition ?? item.condition);
  }).length;

  function patchItem(itemId: string, patch: Partial<ItemDraft>) {
    setDirty(true);
    setItemDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...EMPTY_ITEM,
        ...prev[itemId],
        ...patch,
      },
    }));
  }

  async function persist(completed?: boolean) {
    if (!room) return;
    await save.mutateAsync({
      roomId: room.id,
      room: {
        condition: (roomDraft.condition as Condition | null) ?? null,
        cleanliness: (roomDraft.cleanliness as Cleanliness | null) ?? null,
        notes: roomDraft.notes ?? null,
        ...(completed === undefined ? {} : { completed }),
      },
      items: room.items.map((item) => {
        const draft = itemDrafts[item.id];
        return {
          id: item.id,
          condition: (draft?.condition as Condition | null) ?? null,
          cleanliness: (draft?.cleanliness as Cleanliness | null) ?? null,
          description: draft?.description ?? null,
          notes: draft?.notes ?? null,
          changeStatus: draft?.changeStatus ?? null,
        };
      }),
    });
    setDirty(false);
    setSavedAt(Date.now());
  }

  return (
    <AppShell
      title={room.name}
      subtitle={`${shortAddress(query.data.property)} · ${scored}/${room.items.length} items scored`}
      back={`/reports/${report.id}`}
      wide
      actions={
        locked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1.5 text-[12px] font-medium text-ok">
            <Lock className="size-3.5" />
            Locked
          </span>
        ) : (
          <Button size="sm" onClick={() => void persist()} disabled={save.isPending}>
            <Save className="size-4" />
            <span className="hidden sm:inline">{save.isPending ? "Saving…" : "Save"}</span>
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <ErrorNote error={save.error} />

        {locked && (
          <p className="flex items-start gap-2 rounded-[10px] bg-ok-soft px-3 py-2 text-[13px] text-ok">
            <Lock className="mt-0.5 size-4 shrink-0" />
            This report has been signed and locked. Nothing in this room can be changed.
          </p>
        )}

        <Card className="flex flex-col gap-4 p-4">
          <div>
            <SectionTitle>Overall room</SectionTitle>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Scores the room as a whole. Individual items are recorded below.
            </p>
          </div>
          <ConditionPicker
            value={roomDraft.condition}
            disabled={locked}
            onChange={(value) => {
              setDirty(true);
              setRoomDraft((prev) => ({ ...prev, condition: value }));
            }}
          />
          <CleanlinessPicker
            value={roomDraft.cleanliness}
            disabled={locked}
            onChange={(value) => {
              setDirty(true);
              setRoomDraft((prev) => ({ ...prev, cleanliness: value }));
            }}
          />
          <Textarea
            value={roomDraft.notes ?? ""}
            disabled={locked}
            placeholder="Room notes — decoration, flooring, windows, anything the parties should see."
            onChange={(event) => {
              setDirty(true);
              setRoomDraft((prev) => ({ ...prev, notes: event.target.value }));
            }}
          />
        </Card>

        <section>
          <SectionTitle className="mb-2">Room photos</SectionTitle>
          <Card className="p-3">
            <PhotoGrid
              scope={{ reportId: report.id, roomId: room.id, itemId: null }}
              locked={locked}
              emptyLabel="No room photos yet. Capture wide shots of each wall before scoring items."
            />
          </Card>
        </section>

        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <SectionTitle>Items</SectionTitle>
            <span className="text-[12px] text-ink-500 tabular">
              {scored}/{room.items.length} scored
            </span>
          </div>
          {!locked && room.items.length > 0 && (
            <p className="mb-2 text-[11px] text-ink-500">Swipe an item left to delete it.</p>
          )}

          {room.items.length === 0 ? (
            <Card>
              <EmptyState title="No items in this room yet. Add the first one below." />
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {room.items.map((item) => {
                const draft = itemDrafts[item.id];
                const expanded = open === item.id;
                const previous = item.previousItemId ? previousItems[item.previousItemId] : undefined;
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <SwipeRow
                      label={`Remove ${item.name}`}
                      disabled={locked}
                      pending={removeItem.isPending}
                      onDelete={() => {
                        setOpen(null);
                        removeItem.mutate({ id: item.id });
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : item.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50"
                      >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-ink-900">
                          {item.name}
                          {item.quantity > 1 ? (
                            <span className="ml-1.5 text-[12px] text-ink-500">×{item.quantity}</span>
                          ) : null}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {draft?.condition ? (
                            <ConditionPill value={draft.condition} />
                          ) : (
                            <span className="text-[12px] text-ink-500">Not scored</span>
                          )}
                          <CleanlinessPill value={draft?.cleanliness} />
                          {isCheckOut && <ChangePill value={draft?.changeStatus} />}
                          {photosByItem[item.id] ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-700">
                              <Camera className="size-3" />
                              {photosByItem[item.id]}
                            </span>
                          ) : null}
                        </span>
                      </span>
                        {expanded ? (
                          <ChevronUp className="size-4 shrink-0 text-ink-500" />
                        ) : (
                          <ChevronDown className="size-4 shrink-0 text-ink-500" />
                        )}
                      </button>
                    </SwipeRow>

                    {expanded && (
                      <div className="flex flex-col gap-4 border-t border-ink-100 px-4 py-4">
                        {previous && (
                          <div className="rounded-[10px] bg-brand-50 px-3 py-2 text-[12px] text-brand-800">
                            <span className="font-medium">At check-in: </span>
                            {previous.condition
                              ? CONDITION_LABELS[previous.condition as Condition]
                              : "not scored"}
                            {previous.cleanliness
                              ? ` · ${CLEANLINESS_LABELS[previous.cleanliness as Cleanliness]}`
                              : ""}
                            {previous.description ? ` · ${previous.description}` : ""}
                          </div>
                        )}

                        <ConditionPicker
                          value={draft?.condition ?? null}
                          disabled={locked}
                          onChange={(value) => patchItem(item.id, { condition: value })}
                        />
                        <CleanlinessPicker
                          value={draft?.cleanliness ?? null}
                          disabled={locked}
                          onChange={(value) => patchItem(item.id, { cleanliness: value })}
                        />
                        {isCheckOut && (
                          <ChangeStatusPicker
                            value={draft?.changeStatus ?? null}
                            disabled={locked}
                            onChange={(value) => patchItem(item.id, { changeStatus: value as ChangeStatus | null })}
                          />
                        )}

                        <Input
                          value={draft?.description ?? ""}
                          disabled={locked}
                          placeholder="Description — make, colour, material, size"
                          onChange={(event) => patchItem(item.id, { description: event.target.value })}
                        />
                        <Textarea
                          value={draft?.notes ?? ""}
                          disabled={locked}
                          placeholder="Notes — marks, damage, wear, anything worth evidencing."
                          className="min-h-[70px]"
                          onChange={(event) => patchItem(item.id, { notes: event.target.value })}
                        />

                        <div>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
                            Item photos
                          </p>
                          <PhotoGrid
                            scope={{ reportId: report.id, roomId: room.id, itemId: item.id }}
                            locked={locked}
                            columns="grid-cols-4 md:grid-cols-8"
                            emptyLabel="No photos for this item."
                          />
                        </div>

                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {!locked && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = newItem.trim();
                if (!name) return;
                addItem.mutate(
                  { roomId: room.id, name, quantity: 1 },
                  { onSuccess: () => setNewItem("") },
                );
              }}
            >
              <Input
                value={newItem}
                placeholder="Add an item (e.g. Blackout blind)"
                onChange={(event) => setNewItem(event.target.value)}
              />
              <Button type="submit" variant="outline" disabled={addItem.isPending || !newItem.trim()}>
                <Plus className="size-4" />
                Add
              </Button>
            </form>
          )}
          <ErrorNote error={addItem.error ?? removeItem.error} className="mt-2" />
        </section>

        {!locked && (
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink-900">
                {room.completed ? "Room marked complete" : "Finished this room?"}
              </p>
              <p className="text-[12px] text-ink-500">
                {savedAt
                  ? "Saved. "
                  : dirty
                    ? "You have unsaved changes. "
                    : ""}
                Marking it complete saves your changes and counts towards report progress.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => void persist()} disabled={save.isPending}>
                <Save className="size-4" />
                Save
              </Button>
              {room.completed ? (
                <Button variant="outline" onClick={() => void persist(false)} disabled={save.isPending}>
                  Reopen room
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    await persist(true);
                    navigate(`/reports/${report.id}`);
                  }}
                  disabled={save.isPending}
                >
                  <Check className="size-4" />
                  Mark complete
                </Button>
              )}
            </div>
          </Card>
        )}

        <Link
          href={`/reports/${report.id}`}
          className="pb-2 text-center text-[13px] font-medium text-brand-800 hover:underline"
        >
          Back to inspection
        </Link>
      </div>
    </AppShell>
  );
}
