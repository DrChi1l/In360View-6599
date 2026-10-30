import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { templateFor } from "../lib/domain";
import { newId } from "../lib/ids";
import { authed } from "../middleware/auth";
import { assertEditable, loadReport } from "./reports";

async function loadRoom(roomId: string, userId: string, role?: string | null) {
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, roomId));
  if (!room) throw new ORPCError("NOT_FOUND", { message: "Room not found" });
  const report = await loadReport(room.reportId, userId, role);
  return { room, report };
}

const conditionSchema = z.enum(["excellent", "good", "fair", "poor", "damaged", "na"]).nullable().optional();
const cleanlinessSchema = z
  .enum(["clean", "generally_clean", "fair", "poor", "very_poor", "na"])
  .nullable()
  .optional();

async function touchReport(reportId: string) {
  await db.update(schema.reports).set({ updatedAt: new Date() }).where(eq(schema.reports.id, reportId));
}

export const inspection = {
  addRoom: authed
    .input(
      z.object({
        reportId: z.string(),
        name: z.string().min(1).max(120),
        roomType: z.string().max(40).default("custom"),
        /** Seed the room with its template items. */
        withTemplateItems: z.boolean().default(true),
      }),
    )
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.reportId, context.user.id, context.user.role);
      assertEditable(report);
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${schema.rooms.sortOrder}), -1)` })
        .from(schema.rooms)
        .where(eq(schema.rooms.reportId, report.id));

      const roomId = newId("rm");
      await db.insert(schema.rooms).values({
        id: roomId,
        reportId: report.id,
        name: input.name,
        roomType: input.roomType,
        sortOrder: Number(max ?? -1) + 1,
      });

      if (input.withTemplateItems) {
        const names = templateFor(input.roomType)?.items ?? [];
        if (names.length) {
          await db.insert(schema.items).values(
            names.map((name, i) => ({ id: newId("itm"), roomId, reportId: report.id, name, sortOrder: i })),
          );
        }
      }
      await touchReport(report.id);
      const [row] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, roomId));
      return row;
    }),

  updateRoom: authed
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120).optional(),
        condition: conditionSchema,
        cleanliness: cleanlinessSchema,
        notes: z.string().max(4000).optional().nullable(),
        completed: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { report } = await loadRoom(input.id, context.user.id, context.user.role);
      assertEditable(report);
      const { id, ...values } = input;
      const [row] = await db
        .update(schema.rooms)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.rooms.id, id))
        .returning();
      await touchReport(report.id);
      return row;
    }),

  removeRoom: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const { room, report } = await loadRoom(input.id, context.user.id, context.user.role);
    assertEditable(report);
    await db.delete(schema.items).where(eq(schema.items.roomId, room.id));
    await db.delete(schema.photos).where(eq(schema.photos.roomId, room.id));
    await db.delete(schema.rooms).where(eq(schema.rooms.id, room.id));
    await touchReport(report.id);
    return { ok: true };
  }),

  reorderRooms: authed
    .input(z.object({ reportId: z.string(), ids: z.array(z.string()) }))
    .handler(async ({ input, context }) => {
      const report = await loadReport(input.reportId, context.user.id, context.user.role);
      assertEditable(report);
      for (const [i, id] of input.ids.entries()) {
        await db.update(schema.rooms).set({ sortOrder: i }).where(eq(schema.rooms.id, id));
      }
      return { ok: true };
    }),

  addItem: authed
    .input(
      z.object({
        roomId: z.string(),
        name: z.string().min(1).max(160),
        quantity: z.number().int().min(1).max(99).default(1),
      }),
    )
    .handler(async ({ input, context }) => {
      const { room, report } = await loadRoom(input.roomId, context.user.id, context.user.role);
      assertEditable(report);
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${schema.items.sortOrder}), -1)` })
        .from(schema.items)
        .where(eq(schema.items.roomId, room.id));
      const id = newId("itm");
      await db.insert(schema.items).values({
        id,
        roomId: room.id,
        reportId: report.id,
        name: input.name,
        quantity: input.quantity,
        sortOrder: Number(max ?? -1) + 1,
      });
      await touchReport(report.id);
      const [row] = await db.select().from(schema.items).where(eq(schema.items.id, id));
      return row;
    }),

  updateItem: authed
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(160).optional(),
        quantity: z.number().int().min(0).max(99).optional(),
        condition: conditionSchema,
        cleanliness: cleanlinessSchema,
        description: z.string().max(4000).optional().nullable(),
        notes: z.string().max(4000).optional().nullable(),
        changeStatus: z
          .enum(["unchanged", "changed", "damaged", "missing", "cleaning_required"])
          .nullable()
          .optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [item] = await db.select().from(schema.items).where(eq(schema.items.id, input.id));
      if (!item) throw new ORPCError("NOT_FOUND", { message: "Item not found" });
      const report = await loadReport(item.reportId, context.user.id, context.user.role);
      assertEditable(report);
      const { id, ...values } = input;
      const [row] = await db
        .update(schema.items)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.items.id, id))
        .returning();
      await touchReport(report.id);
      return row;
    }),

  /** One round-trip for a whole room — used by the mobile offline sync queue. */
  saveRoomBatch: authed
    .input(
      z.object({
        roomId: z.string(),
        room: z
          .object({
            condition: conditionSchema,
            cleanliness: cleanlinessSchema,
            notes: z.string().max(4000).optional().nullable(),
            completed: z.boolean().optional(),
          })
          .optional(),
        items: z
          .array(
            z.object({
              id: z.string(),
              condition: conditionSchema,
              cleanliness: cleanlinessSchema,
              description: z.string().max(4000).optional().nullable(),
              notes: z.string().max(4000).optional().nullable(),
              changeStatus: z
                .enum(["unchanged", "changed", "damaged", "missing", "cleaning_required"])
                .nullable()
                .optional(),
            }),
          )
          .default([]),
      }),
    )
    .handler(async ({ input, context }) => {
      const { room, report } = await loadRoom(input.roomId, context.user.id, context.user.role);
      assertEditable(report);
      if (input.room) {
        await db
          .update(schema.rooms)
          .set({ ...input.room, updatedAt: new Date() })
          .where(eq(schema.rooms.id, room.id));
      }
      for (const item of input.items) {
        const { id, ...values } = item;
        await db
          .update(schema.items)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.items.id, id));
      }
      await touchReport(report.id);
      return { ok: true, savedItems: input.items.length };
    }),

  removeItem: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [item] = await db.select().from(schema.items).where(eq(schema.items.id, input.id));
    if (!item) throw new ORPCError("NOT_FOUND");
    const report = await loadReport(item.reportId, context.user.id, context.user.role);
    assertEditable(report);
    await db.delete(schema.photos).where(eq(schema.photos.itemId, item.id));
    await db.delete(schema.items).where(eq(schema.items.id, item.id));
    await touchReport(report.id);
    return { ok: true };
  }),
};
