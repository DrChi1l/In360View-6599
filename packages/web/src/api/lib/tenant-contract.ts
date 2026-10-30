import { z } from "zod";

const id = z.string().min(1).max(100);
const note = z.string().max(10000);
const photoUrl = z
  .string()
  .url()
  .max(3000)
  .refine((v) => new URL(v).protocol === "https:", "Photographs must use HTTPS");
const photos = z.array(photoUrl).max(100).default([]);
const grade = z.enum(["excellent", "good", "fair", "poor", "damaged", "na"]);
const clean = z.enum(["clean", "generally_clean", "fair", "poor", "very_poor", "na"]);
export const tenantSnapshotSchema = z
  .object({
    reference: z.string().min(1).max(100),
    type: z.enum(["check_in", "check_out", "mid_term"]),
    inspectionDate: z.iso.date(),
    inspectorName: z.string().min(1).max(150),
    property: z.object({
      address: z.string().min(1).max(500),
      postcode: z.string().min(1).max(30),
    }),
    summary: note.default(""),
    photoUrls: photos,
    rooms: z
      .array(
        z.object({
          id,
          name: z.string().min(1).max(150),
          notes: note.default(""),
          photoUrls: photos,
          items: z
            .array(
              z.object({
                id,
                name: z.string().min(1).max(150),
                description: note.default(""),
                condition: grade.nullish(),
                cleanliness: clean.nullish(),
                notes: note.default(""),
                quantity: z.number().int().min(0).max(10000).default(1),
                photoUrls: photos,
              }),
            )
            .max(300),
        }),
      )
      .max(100),
    meters: z
      .array(
        z.object({
          type: z.string().max(60),
          serialNumber: z.string().max(150).nullish(),
          reading: z.string().max(150).nullish(),
          location: z.string().max(300).nullish(),
        }),
      )
      .max(30)
      .default([]),
    keys: z
      .array(
        z.object({
          description: z.string().max(500),
          quantity: z.number().int().min(0).max(1000),
          notes: z.string().max(1000).nullish(),
        }),
      )
      .max(50)
      .default([]),
  })
  .superRefine((report, ctx) => {
    const roomIds = report.rooms.map((r) => r.id);
    const itemIds = report.rooms.flatMap((r) => r.items.map((i) => i.id));
    if (new Set(roomIds).size !== roomIds.length || new Set(itemIds).size !== itemIds.length)
      ctx.addIssue({ code: "custom", message: "Room and item IDs must be unique" });
    if (itemIds.length > 3000)
      ctx.addIssue({ code: "custom", message: "Maximum 3,000 items per report" });
  });
export const tenantCreateSchema = z.object({
  schemaVersion: z.literal(1),
  report: tenantSnapshotSchema,
});
export const tenantTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid report link");
export const tokenInput = z.object({ token: tenantTokenSchema });
export const tenantResponseSchema = z.object({
  name: z.string().max(150).default(""),
  comments: z
    .array(z.object({ itemId: id.nullable(), text: z.string().min(1).max(5000) }))
    .max(100)
    .default([]),
  photos: z
    .array(z.object({ assetId: id, itemId: id.nullable(), caption: z.string().max(500) }))
    .max(20)
    .default([]),
  signatureAssetId: id.nullable().default(null),
});
export const tenantSaveSchema = z.object({
  token: tenantTokenSchema,
  revision: z.number().int().nonnegative(),
  response: tenantResponseSchema,
});
export const tenantSubmitSchema = tenantSaveSchema.extend({ accepted: z.literal(true) });
export const TENANT_DECLARATION =
  "I confirm that I have reviewed this inspection report. My comments and photographs are recorded alongside the inspector’s original report. I submit this response with any reservations stated in my comments. My response will be locked after submission.";
export type TenantSnapshot = z.infer<typeof tenantSnapshotSchema>;
export type TenantResponse = z.infer<typeof tenantResponseSchema>;
export type TenantCreate = z.input<typeof tenantCreateSchema>;
