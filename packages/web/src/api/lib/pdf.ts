import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  PDFString,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from "pdf-lib";
import {
  CHANGE_STATUS_LABELS,
  CLEANLINESS_LABELS,
  CONDITION_LABELS,
  REPORT_TYPE_LABELS,
  type ChangeStatus,
  type ReportType,
} from "./domain";
import {
  DECLARATION,
  DISCLAIMER_INTRO,
  DISCLAIMER_POINTS,
  GUIDANCE_INTRO,
  GUIDANCE_NOTES,
  SAFETY_INTRO,
  SAFETY_NOTICES,
  TERMS,
  TERMS_INTRO,
  pickCoverPhoto,
} from "./legal";
import { photoOpenUrl } from "./links";
import { getObjectBytes } from "./s3";
import { isWebp, webpToJpeg } from "./tenant-image";

/**
 * Inspection report PDF.
 *
 * The layout follows the conventional UK "schedule of condition" format that
 * agents, tenants and deposit adjudicators already know how to read: a photo
 * cover, the legal notices up front, a table of contents, a summary reference
 * table, then every room as numbered entries with defects called out in
 * colour and photographs two-up beneath. Branding throughout is In360View.
 */

/* ------------------------------------------------------------------ brand */

const BRAND_900 = rgb(0.043, 0.012, 0.2); // #0B0333 — rules, cover band
const BRAND = rgb(0.071, 0.024, 0.361); // #12065C — label cells
const BRAND_500 = rgb(0.294, 0.212, 0.769); // #4B36C4 — annotated defects
const INK = rgb(0.078, 0.071, 0.122);
const INK_MID = rgb(0.227, 0.216, 0.282);
const INK_SOFT = rgb(0.42, 0.408, 0.502);
const RULE = rgb(0.851, 0.843, 0.886);
const TINT = rgb(0.961, 0.957, 0.988);
const WHITE = rgb(1, 1, 1);
const DANGER = rgb(0.706, 0.09, 0.235); // #B4173C

const STATUS_COLOURS: Record<string, ReturnType<typeof rgb>> = {
  excellent: rgb(0.055, 0.486, 0.353),
  good: rgb(0.122, 0.478, 0.878),
  fair: rgb(0.722, 0.451, 0.043),
  poor: rgb(0.761, 0.255, 0.047),
  damaged: DANGER,
  na: INK_SOFT,
  clean: rgb(0.055, 0.486, 0.353),
  generally_clean: rgb(0.122, 0.478, 0.878),
  very_poor: DANGER,
  unchanged: INK_SOFT,
  changed: rgb(0.722, 0.451, 0.043),
  missing: DANGER,
  cleaning_required: rgb(0.722, 0.451, 0.043),
};

/** Grades that turn a summary row red, the way a failed alarm test would. */
const ALERT_GRADES = new Set(["poor", "damaged", "very_poor", "missing"]);

/* ----------------------------------------------------------------- inputs */

export type PdfPhoto = {
  id: string;
  roomId: string | null;
  itemId: string | null;
  caption: string | null;
  storageKey: string;
  thumbKey: string | null;
};

export type PdfReportData = {
  report: {
    id: string;
    type: string;
    status: string;
    reference: string | null;
    inspectionDate: Date;
    clerkName: string | null;
    clerkEmail: string | null;
    tenantPresent: boolean;
    weather: string | null;
    generalCondition: string | null;
    generalCleanliness: string | null;
    maintenanceIssues: string | null;
    tenantObservations: string | null;
    summaryNotes: string | null;
    completedAt: Date | null;
    lockedAt: Date | null;
  };
  property: {
    addressLine1: string;
    addressLine2: string | null;
    city: string | null;
    postcode: string;
    reference: string | null;
    propertyType: string | null;
    furnishing: string | null;
    bedrooms: number;
    bathrooms: number;
    /** Front elevation uploaded against the property, used as the cover image. */
    frontPhotoKey?: string | null;
    frontPhotoThumbKey?: string | null;
    landlordName: string | null;
    landlordEmail: string | null;
    tenantName: string | null;
    tenantEmail: string | null;
    notes: string | null;
  };
  rooms: {
    id: string;
    name: string;
    condition: string | null;
    cleanliness: string | null;
    notes: string | null;
    items: {
      id: string;
      name: string;
      quantity: number;
      condition: string | null;
      cleanliness: string | null;
      description: string | null;
      notes: string | null;
      changeStatus: string | null;
      previousItemId: string | null;
    }[];
  }[];
  photos: PdfPhoto[];
  signatures: {
    signerRole: string;
    signerName: string;
    signerEmail: string | null;
    statement: string | null;
    signedAt: Date;
    storageKey: string;
  }[];
  meters: { meterType: string; serialNumber: string | null; reading: string | null; location: string | null }[];
  keys: { description: string; quantity: number; notes: string | null }[];
  previousItems: Record<string, { condition: string | null; cleanliness: string | null; description: string | null }>;
  /** Indigo wordmark for white page headers and footers. */
  logoBytes?: Uint8Array | null;
  /** White wordmark for the dark cover band. */
  logoLightBytes?: Uint8Array | null;
};

/* -------------------------------------------------------------- utilities */

const A4 = { w: 595.28, h: 841.89 };
const M = { left: 44, right: 44, top: 88, bottom: 66 };
const CONTENT_W = A4.w - M.left - M.right;

const ukDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(d);
const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const ukDateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const label = (map: Record<string, string>, key?: string | null) => (key ? (map[key] ?? key) : "—");
const sentence = (s: string) => {
  const t = s.trim();
  return t && !/[.!?)]$/.test(t) ? `${t}.` : t;
};

const ROLE_LABELS: Record<string, string> = {
  clerk: "Inventory clerk",
  tenant: "Tenant",
  landlord: "Landlord",
  agent: "Agent",
};

/** The running title, as it appears on the cover and at the top of every page. */
function documentTitle(type: string) {
  if (type === "check_out") return "CHECK-OUT REPORT AND SCHEDULE OF CONDITION FOR:";
  if (type === "mid_term") return "MID-TERM INSPECTION REPORT FOR:";
  return "INVENTORY AND SCHEDULE OF CONDITION FOR:";
}

/** One line of the table of contents, captured as each heading is drawn. */
type OutlineEntry = { title: string; page: number };

/** A run of text in one font and colour, for paragraphs that mix styles. */
type Segment = { text: string; font?: PDFFont; colour?: ReturnType<typeof rgb> };

class Doc {
  doc: PDFDocument;
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  /** Headings collected in document order, used to fill the contents page. */
  outline: OutlineEntry[] = [];
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;

  constructor(doc: PDFDocument, fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont }) {
    this.doc = doc;
    this.regular = fonts.regular;
    this.bold = fonts.bold;
    this.italic = fonts.italic;
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pages.push(this.page);
    this.y = A4.h - M.top;
    return this.page;
  }

  /** The printed number of the page being drawn on (pages are only appended). */
  get pageNumber() {
    return this.pages.length;
  }

  ensure(space: number) {
    if (this.y - space < M.bottom) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
    return this.wrapRich([{ text, font }], size, maxWidth).map((line) => line.map((w) => w.text).join(" "));
  }

  /**
   * Greedy word wrap across mixed-style segments. Returns lines of words, each
   * word keeping the font and colour of the segment it came from.
   */
  wrapRich(segments: Segment[], size: number, maxWidth: number) {
    type Word = { text: string; font: PDFFont; colour: ReturnType<typeof rgb>; newline?: boolean };
    const words: Word[] = [];
    for (const seg of segments) {
      const font = seg.font ?? this.regular;
      const colour = seg.colour ?? INK;
      String(seg.text)
        .split(/(\r?\n)/)
        .forEach((part) => {
          if (/^\r?\n$/.test(part)) {
            words.push({ text: "", font, colour, newline: true });
            return;
          }
          for (const w of part.split(/\s+/)) if (w) words.push({ text: w, font, colour });
        });
    }

    const lines: Word[][] = [];
    let line: Word[] = [];
    let width = 0;
    for (const word of words) {
      if (word.newline) {
        lines.push(line);
        line = [];
        width = 0;
        continue;
      }
      const space = line.length ? word.font.widthOfTextAtSize(" ", size) : 0;
      let w = word.font.widthOfTextAtSize(word.text, size);
      if (line.length && width + space + w > maxWidth) {
        lines.push(line);
        line = [];
        width = 0;
      }
      // A single word longer than the column — hard-break it.
      let text = word.text;
      while (w > maxWidth && text.length > 1) {
        let cut = text.length - 1;
        while (cut > 1 && word.font.widthOfTextAtSize(text.slice(0, cut), size) > maxWidth) cut--;
        lines.push([{ ...word, text: text.slice(0, cut) }]);
        text = text.slice(cut);
        w = word.font.widthOfTextAtSize(text, size);
      }
      line.push({ ...word, text });
      width += (line.length > 1 ? word.font.widthOfTextAtSize(" ", size) : 0) + w;
    }
    if (line.length) lines.push(line);
    return lines;
  }

  /** Flowing paragraph at the cursor, paging as needed. */
  rich(segments: Segment[], opts: { x?: number; width?: number; size?: number; gapAfter?: number } = {}) {
    const size = opts.size ?? 9.5;
    const x0 = opts.x ?? M.left;
    const lh = size * 1.38;
    for (const line of this.wrapRich(segments, size, opts.width ?? CONTENT_W)) {
      this.ensure(lh);
      let x = x0;
      for (const word of line) {
        this.page.drawText(word.text, { x, y: this.y - size, size, font: word.font, color: word.colour });
        x += word.font.widthOfTextAtSize(word.text, size) + word.font.widthOfTextAtSize(" ", size);
      }
      this.y -= lh;
    }
    if (opts.gapAfter) this.y -= opts.gapAfter;
  }

  text(
    value: string,
    opts: { x?: number; size?: number; font?: PDFFont; colour?: ReturnType<typeof rgb>; width?: number; gapAfter?: number } = {},
  ) {
    this.rich([{ text: value, font: opts.font, colour: opts.colour ?? INK_MID }], opts);
  }
}

async function embedPhoto(doc: PDFDocument, bytes: Uint8Array, contentType?: string) {
  // The Flutter app stores photos and signatures as WebP, which pdf-lib cannot embed.
  if (isWebp(bytes)) {
    try {
      bytes = await webpToJpeg(bytes);
      contentType = "image/jpeg";
    } catch {
      return null;
    }
  }
  try {
    if (contentType?.includes("png")) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

/**
 * Turns a rectangle on the page into a clickable link. pdf-lib has no helper
 * for link annotations, so the annotation dictionary is built by hand.
 */
function drawLink(d: Doc, url: string, rect: { x: number; y: number; width: number; height: number }) {
  const annot = d.doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    F: 4,
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  d.page.node.addAnnot(d.doc.context.register(annot));
}

/** Draws an image aspect-filled into a rectangle, cropping the overflow. */
function drawImageFill(page: PDFPage, image: PDFImage, box: { x: number; y: number; w: number; h: number }) {
  const ratio = image.width / image.height;
  let w = box.w;
  let h = box.w / ratio;
  if (h < box.h) {
    h = box.h;
    w = box.h * ratio;
  }
  page.pushOperators(
    pushGraphicsState(),
    moveTo(box.x, box.y),
    lineTo(box.x + box.w, box.y),
    lineTo(box.x + box.w, box.y + box.h),
    lineTo(box.x, box.y + box.h),
    closePath(),
    clip(),
    endPath(),
  );
  page.drawImage(image, { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, width: w, height: h });
  page.pushOperators(popGraphicsState());
}

/* ---------------------------------------------------------------- headings */

/** Bold caps heading with a full-width rule beneath — rooms and sections. */
function sectionHeading(d: Doc, title: string, opts: { outline?: boolean; right?: Segment[]; space?: number } = {}) {
  d.ensure(opts.space ?? 60);
  if (opts.outline !== false) d.outline.push({ title, page: d.pageNumber });
  const text = title.toUpperCase();
  d.page.drawText(text, { x: M.left, y: d.y - 11, size: 10.5, font: d.bold, color: INK });
  if (opts.right?.length) {
    const size = 7.2;
    let width = 0;
    for (const s of opts.right) width += (s.font ?? d.bold).widthOfTextAtSize(s.text, size);
    let x = A4.w - M.right - width;
    for (const s of opts.right) {
      const font = s.font ?? d.bold;
      d.page.drawText(s.text, { x, y: d.y - 10, size, font, color: s.colour ?? INK_SOFT });
      x += font.widthOfTextAtSize(s.text, size);
    }
  }
  d.y -= 16;
  d.page.drawLine({ start: { x: M.left, y: d.y }, end: { x: A4.w - M.right, y: d.y }, thickness: 1, color: INK });
  d.y -= 10;
}

/** Caps heading underlined to the width of its own text — sub-sections. */
function subHeading(d: Doc, title: string, opts: { size?: number; font?: PDFFont; right?: Segment[] } = {}) {
  const size = opts.size ?? 9.5;
  const font = opts.font ?? d.regular;
  d.ensure(size * 1.4 + 24);
  const text = title.toUpperCase();
  const clipped = d.wrap(text, font, size, CONTENT_W - 170)[0] ?? text;
  d.page.drawText(clipped, { x: M.left, y: d.y - size, size, font, color: INK });
  const w = font.widthOfTextAtSize(clipped, size);
  d.page.drawLine({
    start: { x: M.left, y: d.y - size - 2.6 },
    end: { x: M.left + w, y: d.y - size - 2.6 },
    thickness: 0.6,
    color: INK,
  });
  if (opts.right?.length) {
    const rs = 6.8;
    let width = 0;
    for (const s of opts.right) width += (s.font ?? d.bold).widthOfTextAtSize(s.text, rs);
    let x = A4.w - M.right - width;
    for (const s of opts.right) {
      const f = s.font ?? d.bold;
      d.page.drawText(s.text, { x, y: d.y - size + 0.5, size: rs, font: f, color: s.colour ?? INK_SOFT });
      x += f.widthOfTextAtSize(s.text, rs);
    }
  }
  d.y -= size * 1.4 + 6;
}

/** "CONDITION: GOOD  ·  CLEANLINESS: CLEAN", each grade in its status colour. */
function gradeSegments(d: Doc, condition?: string | null, cleanliness?: string | null, change?: string | null): Segment[] {
  const out: Segment[] = [];
  const push = (key: string, value: string, colourKey: string) => {
    if (out.length) out.push({ text: "     ", font: d.regular });
    out.push({ text: `${key}: `, font: d.regular, colour: INK_SOFT });
    out.push({ text: value.toUpperCase(), font: d.bold, colour: STATUS_COLOURS[colourKey] ?? INK_SOFT });
  };
  if (condition) push("CONDITION", label(CONDITION_LABELS, condition), condition);
  if (cleanliness) push("CLEANLINESS", label(CLEANLINESS_LABELS, cleanliness), cleanliness);
  if (change && change !== "unchanged") push("CHANGE", label(CHANGE_STATUS_LABELS, change as ChangeStatus), change);
  return out;
}

/* ------------------------------------------------------------------- cover */

function drawCover(
  d: Doc,
  data: PdfReportData,
  images: { cover: PDFImage | null; logo: PDFImage | null; logoLight: PDFImage | null },
) {
  const page = d.page;
  const bandH = 330;

  /* Front elevation, full bleed across the top of the page. */
  const photoBox = { x: 0, y: bandH, w: A4.w, h: A4.h - bandH };
  if (images.cover) {
    drawImageFill(page, images.cover, photoBox);
  } else {
    page.drawRectangle({ x: 0, y: bandH, width: A4.w, height: A4.h - bandH, color: TINT });
    if (images.logo) {
      const w = 260;
      const h = (images.logo.height / images.logo.width) * w;
      page.drawImage(images.logo, { x: (A4.w - w) / 2, y: bandH + (A4.h - bandH - h) / 2, width: w, height: h, opacity: 0.9 });
    }
  }

  /* Reference box, top left over the photograph. */
  const ref = `Report Ref: ${data.report.reference ?? data.report.id.slice(0, 8).toUpperCase()}`;
  const date = `Date: ${shortDate(data.report.inspectionDate)}`;
  const boxW = Math.max(d.bold.widthOfTextAtSize(ref, 11), d.bold.widthOfTextAtSize(date, 11)) + 28;
  page.drawRectangle({ x: 34, y: A4.h - 34 - 50, width: boxW, height: 50, color: WHITE });
  page.drawText(ref, { x: 48, y: A4.h - 54, size: 11, font: d.bold, color: INK });
  page.drawText(date, { x: 48, y: A4.h - 72, size: 11, font: d.bold, color: INK });

  /* Brand band. */
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: bandH, color: BRAND_900 });
  page.drawRectangle({ x: 0, y: bandH - 4, width: A4.w, height: 4, color: BRAND_500 });

  const left = M.left;
  let y = bandH - 52;
  if (images.logoLight) {
    const w = 168;
    const h = (images.logoLight.height / images.logoLight.width) * w;
    page.drawImage(images.logoLight, { x: left, y: y - h + 12, width: w, height: h });
    y -= h + 4;
  } else {
    page.drawText("In360View", { x: left, y: y - 18, size: 26, font: d.bold, color: WHITE });
    y -= 34;
  }
  page.drawText("INVENTORIES  ·  INSPECTIONS  ·  REPORTS", { x: left, y: y - 4, size: 7.5, font: d.bold, color: rgb(0.72, 0.7, 0.86) });

  /* Title and address. */
  y -= 40;
  const titleSize = 15;
  for (const line of d.wrap(documentTitle(data.report.type), d.bold, titleSize, CONTENT_W)) {
    page.drawText(line, { x: left, y, size: titleSize, font: d.bold, color: WHITE });
    y -= titleSize * 1.25;
  }
  const address = [data.property.addressLine1, data.property.addressLine2, data.property.city, data.property.postcode]
    .filter(Boolean)
    .map((s) => String(s).toUpperCase());
  for (const line of address.slice(0, 4)) {
    page.drawText(line, { x: left, y, size: titleSize, font: d.bold, color: WHITE });
    y -= titleSize * 1.25;
  }

  /* Parties. */
  const partyTop = 92;
  const parties: [string, string[]][] = [
    ["Landlord:", [data.property.landlordName ?? "—", data.property.landlordEmail ?? ""].filter(Boolean)],
    ["Tenant:", [data.property.tenantName ?? "—", data.property.tenantEmail ?? ""].filter(Boolean)],
    [
      "Inspected by:",
      [data.report.clerkName ?? "In360View", REPORT_TYPE_LABELS[data.report.type as ReportType] ?? data.report.type],
    ],
  ];
  const colW = CONTENT_W / 3;
  parties.forEach(([head, lines], i) => {
    const x = left + i * colW;
    page.drawText(head, { x, y: partyTop, size: 8.5, font: d.bold, color: WHITE });
    lines.forEach((line, n) => {
      const clipped = d.wrap(line, d.regular, 8.5, colW - 12)[0] ?? "";
      page.drawText(clipped, { x, y: partyTop - 13 - n * 12, size: 8.5, font: d.regular, color: rgb(0.85, 0.84, 0.94) });
    });
  });

  /* Produced-by line. */
  page.drawLine({ start: { x: left, y: 40 }, end: { x: A4.w - M.right, y: 40 }, thickness: 0.5, color: rgb(0.3, 0.26, 0.5) });
  const produced = "Produced by In360View  ·  Inventories, Inspections & Reports";
  page.drawText(produced, {
    x: (A4.w - d.bold.widthOfTextAtSize(produced, 8.5)) / 2,
    y: 24,
    size: 8.5,
    font: d.bold,
    color: WHITE,
  });
}

/* ------------------------------------------------------------- page frame */

/** Running header and footer on every page after the cover. */
function drawFrames(d: Doc, data: PdfReportData, logo: PDFImage | null) {
  const total = d.pages.length;
  const title = documentTitle(data.report.type);
  const address = `${data.property.addressLine1} ${data.property.postcode}`.toUpperCase();
  const ref = `Ref ${data.report.reference ?? data.report.id.slice(0, 8).toUpperCase()}`;
  const produced = shortDate(data.report.completedAt ?? new Date());

  d.pages.forEach((page, i) => {
    if (i === 0) return;
    const n = i + 1;
    /* header */
    page.drawText(title, { x: M.left, y: A4.h - 40, size: 8.5, font: d.regular, color: INK });
    page.drawText(d.wrap(address, d.regular, 8.5, CONTENT_W - 120)[0] ?? address, {
      x: M.left,
      y: A4.h - 51,
      size: 8.5,
      font: d.regular,
      color: INK,
    });
    const rightX = A4.w - M.right - 78;
    page.drawText(ref, { x: rightX, y: A4.h - 40, size: 8.5, font: d.regular, color: INK });
    page.drawText(`Page ${n}`, { x: rightX, y: A4.h - 51, size: 8.5, font: d.regular, color: INK });
    page.drawRectangle({ x: M.left, y: A4.h - 62, width: CONTENT_W, height: 2.2, color: BRAND_900 });

    /* footer */
    page.drawRectangle({ x: M.left, y: 48, width: CONTENT_W, height: 2.2, color: BRAND_900 });
    page.drawText(`Page ${n} of ${total}`, { x: M.left, y: 28, size: 8.5, font: d.regular, color: INK });
    if (logo) {
      const w = 74;
      const h = (logo.height / logo.width) * w;
      page.drawImage(logo, { x: (A4.w - w) / 2, y: 33 - h / 2, width: w, height: h });
    }
    const p1 = "Produced";
    page.drawText(p1, { x: A4.w - M.right - d.regular.widthOfTextAtSize(p1, 8.5), y: 34, size: 8.5, font: d.regular, color: INK });
    page.drawText(produced, {
      x: A4.w - M.right - d.regular.widthOfTextAtSize(produced, 8.5),
      y: 23,
      size: 8.5,
      font: d.regular,
      color: INK,
    });
  });
}

/* -------------------------------------------------------- legal & guidance */

/** Plain caps heading with a paragraph beneath — the front-matter style. */
function legalBlock(d: Doc, title: string, body: string, opts: { heading?: "caps" | "underline" } = {}) {
  d.ensure(50);
  if (opts.heading === "underline") {
    subHeading(d, title, { size: 8.6, font: d.bold });
  } else {
    d.text(title.toUpperCase(), { size: 9, font: d.bold, colour: INK, gapAfter: 2 });
  }
  d.text(body, { size: 8.2, colour: INK_MID, gapAfter: 9 });
}

function drawFrontMatter(d: Doc) {
  /* Disclaimer */
  d.outline.push({ title: "Disclaimer", page: d.pageNumber });
  d.text("DISCLAIMER", { size: 9.5, font: d.bold, colour: INK, gapAfter: 2 });
  d.text(DISCLAIMER_INTRO, { size: 8.2, colour: INK_MID, gapAfter: 7 });
  for (const point of DISCLAIMER_POINTS) {
    d.ensure(30);
    d.rich(
      [
        { text: `${point.title}.`, font: d.bold, colour: INK },
        { text: point.body, colour: INK_MID },
      ],
      { size: 8.2, gapAfter: 6 },
    );
  }
  d.text(
    "It is strongly recommended that the landlord and tenant validate this report to confirm its accuracy. Any query or assumed discrepancy should be raised with the In360View inspector or with In360View directly within the checking period set out in the terms and conditions.",
    { size: 8.2, colour: INK_MID, gapAfter: 12 },
  );

  /* Safety notices */
  d.outline.push({ title: "Safety notices & regulations", page: d.pageNumber });
  d.text(SAFETY_INTRO, { size: 8.2, font: d.italic, colour: INK_SOFT, gapAfter: 8 });
  for (const notice of SAFETY_NOTICES) legalBlock(d, notice.title, notice.body);

  /* Guidance notes */
  d.y -= 4;
  d.outline.push({ title: "Guidance notes", page: d.pageNumber });
  d.ensure(80);
  d.text("GUIDANCE NOTES FOR LANDLORDS, TENANTS AND ADJUDICATORS ON THE USE OF THIS DOCUMENT", {
    size: 9.5,
    font: d.bold,
    colour: INK,
    gapAfter: 2,
  });
  d.text(GUIDANCE_INTRO, { size: 8.2, colour: INK_MID, gapAfter: 8 });
  for (const note of GUIDANCE_NOTES) legalBlock(d, note.title, note.body, { heading: "underline" });

  /* Terms & conditions */
  d.y -= 4;
  d.outline.push({ title: "Terms & conditions", page: d.pageNumber });
  d.ensure(80);
  d.text("TERMS AND CONDITIONS", { size: 9.5, font: d.bold, colour: INK, gapAfter: 2 });
  d.text(TERMS_INTRO, { size: 8.2, colour: INK_MID, gapAfter: 8 });
  for (const term of TERMS) {
    d.ensure(30);
    d.rich(
      [
        { text: term.title, font: d.bold, colour: INK },
        { text: term.body, colour: INK_MID },
      ],
      { size: 8.2, gapAfter: 6 },
    );
  }
}

/* --------------------------------------------------------- contents page */

function drawContentsPage(d: Doc, page: PDFPage, outline: OutlineEntry[]) {
  let y = A4.h - M.top;
  page.drawText("TABLE OF CONTENTS", { x: M.left, y: y - 11, size: 10.5, font: d.bold, color: INK });
  y -= 16;
  page.drawLine({ start: { x: M.left, y }, end: { x: A4.w - M.right, y }, thickness: 1, color: INK });
  y -= 18;

  const rowH = 17;
  const fits = Math.max(0, Math.floor((y - M.bottom) / rowH));
  const size = 9.5;
  for (const entry of outline.slice(0, fits)) {
    const text = d.wrap(entry.title.toUpperCase(), d.regular, size, CONTENT_W - 60)[0] ?? "";
    page.drawText(text, { x: M.left, y: y - size, size, font: d.regular, color: INK });
    const pageText = String(entry.page);
    const pw = d.regular.widthOfTextAtSize(pageText, size);
    page.drawText(pageText, { x: A4.w - M.right - pw, y: y - size, size, font: d.regular, color: INK });
    const start = M.left + d.regular.widthOfTextAtSize(text, size) + 4;
    const end = A4.w - M.right - pw - 4;
    const dot = d.regular.widthOfTextAtSize(".", size);
    let dots = "";
    while (dots.length * dot < end - start - dot) dots += ".";
    page.drawText(dots, { x: start, y: y - size, size, font: d.regular, color: INK });
    y -= rowH;
  }
}

/* ------------------------------------------------------ summary reference */

type SummaryRow = { label: string; value: string; alert?: boolean };

/** Two-column reference table: indigo label cells, bordered value cells. */
function summaryTable(d: Doc, rows: SummaryRow[]) {
  const labelW = 170;
  const size = 9.5;
  const pad = 7;
  for (const row of rows) {
    const labelLines = d.wrap(row.label.toUpperCase(), d.bold, size, labelW - pad * 2);
    const valueLines = d.wrap(row.value || "—", d.regular, size, CONTENT_W - labelW - pad * 2);
    const lines = Math.max(labelLines.length, valueLines.length);
    const h = lines * size * 1.3 + pad * 2 - 2;
    d.ensure(h + 8);
    const top = d.y;
    const fill = row.alert ? DANGER : BRAND;
    d.page.drawRectangle({ x: M.left, y: top - h, width: labelW, height: h, color: fill });
    d.page.drawRectangle({
      x: M.left + labelW,
      y: top - h,
      width: CONTENT_W - labelW,
      height: h,
      color: WHITE,
      borderColor: fill,
      borderWidth: 0.8,
    });
    const labelTop = top - (h - labelLines.length * size * 1.3) / 2;
    labelLines.forEach((line, i) => {
      d.page.drawText(line, { x: M.left + pad, y: labelTop - size - i * size * 1.3 + 2, size, font: d.bold, color: WHITE });
    });
    const valueTop = top - (h - valueLines.length * size * 1.3) / 2;
    valueLines.forEach((line, i) => {
      d.page.drawText(line, {
        x: M.left + labelW + pad,
        y: valueTop - size - i * size * 1.3 + 2,
        size,
        font: d.regular,
        color: INK,
      });
    });
    d.y = top - h - 7;
  }
}

/** A meter block: full-width indigo title bar over bordered label/value rows. */
function meterTable(d: Doc, title: string, rows: [string, string][]) {
  const size = 9.5;
  const rowH = 22;
  const labelW = 170;
  d.ensure(rowH * (rows.length + 1) + 10);
  let top = d.y;
  d.page.drawRectangle({ x: M.left, y: top - rowH, width: CONTENT_W, height: rowH, color: BRAND });
  d.page.drawText(title.toUpperCase(), { x: M.left + 7, y: top - rowH + 7, size, font: d.bold, color: WHITE });
  top -= rowH;
  for (const [k, v] of rows) {
    d.page.drawRectangle({ x: M.left, y: top - rowH, width: labelW, height: rowH, color: WHITE, borderColor: BRAND, borderWidth: 0.8 });
    d.page.drawRectangle({
      x: M.left + labelW,
      y: top - rowH,
      width: CONTENT_W - labelW,
      height: rowH,
      color: WHITE,
      borderColor: BRAND,
      borderWidth: 0.8,
    });
    d.page.drawText(k.toUpperCase(), { x: M.left + 7, y: top - rowH + 7, size, font: d.regular, color: INK });
    const value = d.wrap(v || "—", d.regular, size, CONTENT_W - labelW - 14)[0] ?? "—";
    d.page.drawText(value, { x: M.left + labelW + 7, y: top - rowH + 7, size, font: d.regular, color: INK });
    top -= rowH;
  }
  d.y = top - 9;
}

const SMOKE = /smoke/i;
const CO = /carbon|(^|\W)co(\W|$)|co2?\s*alarm|monoxide/i;
const FAILED = /not respond|did not|didn'?t|fail|missing|no alarm|not working|faulty|removed/i;

function alarmRows(data: PdfReportData) {
  const find = (re: RegExp) =>
    data.rooms.flatMap((room) =>
      room.items.filter((item) => re.test(item.name)).map((item) => ({ room: room.name, item })),
    );
  const describe = (kind: string, found: ReturnType<typeof find>): SummaryRow[] => {
    if (!found.length) return [];
    const location = found.map((f) => f.room).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    const notes = found
      .map((f) => [f.item.description, f.item.notes].filter(Boolean).join(" — "))
      .filter(Boolean)
      .join(" ");
    const failed = found.some(
      (f) => ALERT_GRADES.has(f.item.condition ?? "") || FAILED.test(`${f.item.notes ?? ""} ${f.item.description ?? ""}`),
    );
    return [
      { label: `${kind} location`, value: sentence(location) },
      { label: `${kind} condition`, value: sentence(notes || "Recorded present; see room entries."), alert: failed },
    ];
  };
  return [...describe("Smoke alarm", find(SMOKE)), ...describe("CO alarm", find(CO).filter((f) => !SMOKE.test(f.item.name)))];
}

function drawSummary(d: Doc, data: PdfReportData) {
  sectionHeading(d, "Summary reference");
  const p = data.property;
  const r = data.report;
  const description = [
    p.bedrooms ? `${p.bedrooms} bedroom` : null,
    p.furnishing?.toLowerCase(),
    p.propertyType?.toLowerCase() ?? "property",
    p.bathrooms ? `with ${p.bathrooms} bathroom${p.bathrooms === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const rows: SummaryRow[] = [
    { label: "Description", value: sentence(description.charAt(0).toUpperCase() + description.slice(1)) },
    { label: "Report type", value: REPORT_TYPE_LABELS[r.type as ReportType] ?? r.type },
    { label: "Inspection date", value: ukDate(r.inspectionDate) },
    { label: "Inspected by", value: [r.clerkName, r.clerkEmail].filter(Boolean).join(" — ") || "In360View" },
    { label: "Tenant present", value: r.tenantPresent ? "Yes." : "No." },
  ];
  if (r.weather) rows.push({ label: "Weather", value: sentence(r.weather) });
  if (data.keys.length) {
    rows.push({
      label: "Keys",
      value: data.keys.map((k) => sentence(`${k.quantity} x ${k.description}${k.notes ? ` (${k.notes})` : ""}`)).join("\n"),
    });
  }
  if (r.generalCondition) {
    rows.push({
      label: "Decorative order",
      value: sentence(`${label(CONDITION_LABELS, r.generalCondition)} overall condition`),
      alert: ALERT_GRADES.has(r.generalCondition),
    });
  }
  if (r.generalCleanliness) {
    rows.push({
      label: "Cleaning (general)",
      value: sentence(`${label(CLEANLINESS_LABELS, r.generalCleanliness)} throughout`),
      alert: ALERT_GRADES.has(r.generalCleanliness),
    });
  }
  rows.push(...alarmRows(data));
  if (r.summaryNotes?.trim()) rows.push({ label: "Summary", value: sentence(r.summaryNotes) });
  if (r.maintenanceIssues?.trim()) rows.push({ label: "Maintenance issues", value: sentence(r.maintenanceIssues), alert: true });
  if (r.tenantObservations?.trim()) rows.push({ label: "Tenant observations", value: sentence(r.tenantObservations) });
  const meterLocations = data.meters.map((m) => m.location).filter(Boolean);
  if (meterLocations.length) {
    rows.push({
      label: "Meters location",
      value: data.meters
        .filter((m) => m.location)
        .map((m) => `${meterName(m.meterType)}: ${m.location}`)
        .join("; "),
    });
  }
  summaryTable(d, rows);

  for (const m of data.meters) {
    meterTable(d, `${meterName(m.meterType)} meter`, [
      ["Serial", m.serialNumber ?? "Unable to locate."],
      ["Reading", m.reading ?? "Unable to read."],
    ]);
  }
}

function meterName(type: string) {
  return type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ rooms */

type GridImage = { image: PDFImage; caption: string; sub?: string | null; url?: string | null };

/** Photographs two-up, contained in their cell, captioned ROOM#n beneath. */
function drawPhotoPairs(d: Doc, images: GridImage[]) {
  const gap = 28;
  const cellW = (CONTENT_W - gap) / 2;
  const maxH = 248;
  for (let i = 0; i < images.length; i += 2) {
    const pair = images.slice(i, i + 2);
    const sized = pair.map((p) => {
      const ratio = p.image.width / p.image.height;
      let w = cellW;
      let h = cellW / ratio;
      if (h > maxH) {
        h = maxH;
        w = maxH * ratio;
      }
      return { ...p, w, h };
    });
    const rowH = Math.max(...sized.map((s) => s.h)) + 36;
    d.ensure(rowH + 6);
    const top = d.y - 8;
    sized.forEach((s, n) => {
      const cx = M.left + n * (cellW + gap) + cellW / 2;
      const x = cx - s.w / 2;
      const y = top - s.h;
      d.page.drawImage(s.image, { x, y, width: s.w, height: s.h });
      if (s.url) drawLink(d, s.url, { x, y, width: s.w, height: s.h });
      const cap = s.caption.toUpperCase();
      d.page.drawText(cap, {
        x: cx - d.regular.widthOfTextAtSize(cap, 9.5) / 2,
        y: top - s.h - 14,
        size: 9.5,
        font: d.regular,
        color: INK,
      });
      if (s.sub) {
        const sub = d.wrap(s.sub, d.regular, 7, cellW)[0] ?? "";
        d.page.drawText(sub, {
          x: cx - d.regular.widthOfTextAtSize(sub, 7) / 2,
          y: top - s.h - 24,
          size: 7,
          font: d.regular,
          color: INK_SOFT,
        });
      }
    });
    d.y = top - rowH;
  }
}

/** A numbered entry: description in ink, defects in colour, comparison in grey. */
function itemEntry(
  d: Doc,
  number: number,
  item: PdfReportData["rooms"][number]["items"][number],
  previous: PdfReportData["previousItems"][string] | undefined,
  isCheckOut: boolean,
) {
  subHeading(d, item.name, {
    right: gradeSegments(d, item.condition, item.cleanliness, isCheckOut ? item.changeStatus : null),
  });

  const segments: Segment[] = [];
  const base = item.description?.trim() || item.name;
  segments.push({ text: `${item.quantity > 1 ? `${item.quantity} x ` : ""}${base.replace(/[.\s]+$/, "")}`, colour: INK });
  if (item.notes?.trim()) segments.push({ text: `(${item.notes.trim().replace(/[.\s]+$/, "")})`, colour: BRAND_500 });
  segments[segments.length - 1].text += ".";
  if (isCheckOut && previous) {
    const prev = [
      previous.condition ? label(CONDITION_LABELS, previous.condition) : null,
      previous.cleanliness ? label(CLEANLINESS_LABELS, previous.cleanliness) : null,
    ]
      .filter(Boolean)
      .join(" / ");
    if (prev || previous.description) {
      segments.push({
        text: `\nAt check-in: ${[prev, previous.description].filter(Boolean).join(" — ")}`,
        font: d.italic,
        colour: INK_SOFT,
      });
    }
  }

  d.ensure(14);
  const numberText = `${number}.`;
  d.page.drawText(numberText, { x: M.left + 2, y: d.y - 9.5, size: 9.5, font: d.regular, color: INK });
  d.rich(segments, { x: M.left + 30, width: CONTENT_W - 30, size: 9.5, gapAfter: 5 });
}

/* ------------------------------------------------------------- signatures */

async function drawSignatures(d: Doc, data: PdfReportData, doc: PDFDocument) {
  d.newPage();
  sectionHeading(d, "Declaration & signatures");
  d.text(DECLARATION, { size: 9, colour: INK_MID, gapAfter: 14 });

  const labelW = 170;
  const h = 78;
  const entries: { role: string; name: string; meta: string[]; image: PDFImage | null }[] = [];
  if (data.signatures.length) {
    for (const sig of data.signatures) {
      const bytes = await getObjectBytes(sig.storageKey);
      entries.push({
        role: ROLE_LABELS[sig.signerRole] ?? sig.signerRole,
        name: sig.signerName,
        meta: [sig.signerEmail ?? "", `Signed ${ukDateTime(sig.signedAt)}`].filter(Boolean),
        image: bytes ? await embedPhoto(doc, bytes, "image/png") : null,
      });
    }
  } else {
    for (const role of ["Inventory clerk", "Tenant", "Landlord"]) entries.push({ role, name: "", meta: [], image: null });
  }

  for (const e of entries) {
    d.ensure(h + 10);
    const top = d.y;
    d.page.drawRectangle({ x: M.left, y: top - h, width: labelW, height: h, color: BRAND });
    d.page.drawRectangle({
      x: M.left + labelW,
      y: top - h,
      width: CONTENT_W - labelW,
      height: h,
      color: WHITE,
      borderColor: BRAND,
      borderWidth: 0.8,
    });
    d.page.drawText(e.role.toUpperCase(), { x: M.left + 7, y: top - 18, size: 9.5, font: d.bold, color: WHITE });
    const vx = M.left + labelW + 9;
    if (e.name) {
      d.page.drawText(e.name, { x: vx, y: top - 18, size: 10, font: d.bold, color: INK });
      e.meta.forEach((m, i) => {
        d.page.drawText(m, { x: vx, y: top - 32 - i * 11, size: 8, font: d.regular, color: INK_MID });
      });
    } else {
      d.page.drawText("Name", { x: vx, y: top - 18, size: 8, font: d.regular, color: INK_SOFT });
      d.page.drawText("Signature", { x: vx, y: top - h + 10, size: 8, font: d.regular, color: INK_SOFT });
      d.page.drawText("Date", { x: A4.w - M.right - 90, y: top - h + 10, size: 8, font: d.regular, color: INK_SOFT });
      d.page.drawLine({ start: { x: vx + 48, y: top - h + 9 }, end: { x: A4.w - M.right - 100, y: top - h + 9 }, thickness: 0.5, color: RULE });
    }
    if (e.image) {
      const maxW = 150;
      const maxH = 52;
      const ratio = e.image.width / e.image.height;
      let w = maxW;
      let ih = maxW / ratio;
      if (ih > maxH) {
        ih = maxH;
        w = maxH * ratio;
      }
      d.page.drawImage(e.image, { x: A4.w - M.right - w - 10, y: top - h + (h - ih) / 2, width: w, height: ih });
    }
    d.y = top - h - 8;
  }

  d.y -= 6;
  if (data.report.lockedAt) {
    d.text(`Document locked ${ukDateTime(data.report.lockedAt)} — this is the final signed version.`, {
      size: 8.5,
      font: d.italic,
      colour: INK_SOFT,
    });
  } else if (!data.signatures.length) {
    d.text("This report has not yet been signed.", { size: 8.5, font: d.italic, colour: INK_SOFT });
  }
}

/* ------------------------------------------------------------------ build */

export async function buildReportPdf(data: PdfReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${REPORT_TYPE_LABELS[data.report.type as ReportType] ?? "Report"} — ${data.property.addressLine1}`);
  doc.setAuthor("In360View");
  doc.setCreator("In360View");
  doc.setProducer("In360View");
  doc.setSubject("Property inventory and schedule of condition");

  const d = new Doc(doc, {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  });

  const logo = data.logoBytes ? await embedPhoto(doc, data.logoBytes, "image/png") : null;
  const logoLight = data.logoLightBytes ? await embedPhoto(doc, data.logoLightBytes, "image/png") : null;

  /* Cover photograph: the uploaded front elevation wins over a guess. */
  const roomNameById = (roomId: string) => data.rooms.find((r) => r.id === roomId)?.name;
  const coverChoice = data.property.frontPhotoKey
    ? { storageKey: data.property.frontPhotoKey, thumbKey: data.property.frontPhotoThumbKey }
    : pickCoverPhoto(data.photos, roomNameById);
  let cover: PDFImage | null = null;
  if (coverChoice) {
    const bytes =
      (await getObjectBytes(coverChoice.storageKey)) ??
      (coverChoice.thumbKey ? await getObjectBytes(coverChoice.thumbKey) : null);
    if (bytes) cover = await embedPhoto(doc, bytes);
  }

  d.newPage();
  drawCover(d, data, { cover, logo, logoLight });

  /* Legal notices, guidance and terms up front, as adjudicators expect. */
  d.newPage();
  drawFrontMatter(d);

  /* Contents is reserved here and filled once every page number is known. */
  d.newPage();
  const contentsPage = d.page;

  d.newPage();
  drawSummary(d, data);

  if (data.photos.length) {
    d.y -= 4;
    d.text(
      "Photographs in this report are linked — select any photograph to open the original full-resolution image in your browser.",
      { size: 7.8, font: d.italic, colour: INK_SOFT, gapAfter: 4 },
    );
  }

  /* Rooms */
  const isCheckOut = data.report.type === "check_out";
  const MAX_PHOTOS = 700;
  let embedded = 0;
  const cache = new Map<string, PDFImage | null>();
  const loadImage = async (photo: PdfPhoto) => {
    if (cache.has(photo.storageKey)) return cache.get(photo.storageKey) ?? null;
    if (embedded >= MAX_PHOTOS) return null;
    const bytes = (await getObjectBytes(photo.storageKey)) ?? (photo.thumbKey ? await getObjectBytes(photo.thumbKey) : null);
    const image = bytes ? await embedPhoto(doc, bytes) : null;
    if (image) embedded++;
    cache.set(photo.storageKey, image);
    return image;
  };

  let entryNumber = 0;
  for (const room of data.rooms) {
    d.y -= 6;
    sectionHeading(d, room.name, { right: gradeSegments(d, room.condition, room.cleanliness), space: 90 });
    if (room.notes?.trim()) d.text(sentence(room.notes), { size: 9, font: d.italic, colour: INK_MID, gapAfter: 6 });

    const inspected = room.items.filter(
      (i) => i.condition || i.cleanliness || i.description || i.notes || data.photos.some((p) => p.itemId === i.id),
    );
    const listed = inspected.length ? inspected : room.items;
    const numberOf = new Map<string, number>();
    for (const item of listed) {
      entryNumber++;
      numberOf.set(item.id, entryNumber);
      itemEntry(d, entryNumber, item, item.previousItemId ? data.previousItems[item.previousItemId] : undefined, isCheckOut);
    }

    /* All of the room's photographs follow its entries, numbered ROOM#n. */
    const roomPhotos = data.photos.filter(
      (p) => p.roomId === room.id || (p.itemId && room.items.some((i) => i.id === p.itemId)),
    );
    if (roomPhotos.length) {
      const images: GridImage[] = [];
      for (const p of roomPhotos) {
        const image = await loadImage(p);
        if (!image) continue;
        const item = p.itemId ? room.items.find((i) => i.id === p.itemId) : undefined;
        const ref = item && numberOf.has(item.id) ? `Entry ${numberOf.get(item.id)} — ${item.name}` : null;
        images.push({
          image,
          caption: `${room.name}#${images.length + 1}`,
          sub: [ref, p.caption].filter(Boolean).join(" · ") || null,
          url: photoOpenUrl(p.id),
        });
      }
      drawPhotoPairs(d, images);
    }
  }

  /* Unattached photographs */
  const loose = data.photos.filter((p) => !p.roomId && !p.itemId);
  if (loose.length) {
    sectionHeading(d, "Additional photographs");
    const images: GridImage[] = [];
    for (const p of loose) {
      const image = await loadImage(p);
      if (image) images.push({ image, caption: `Additional#${images.length + 1}`, sub: p.caption, url: photoOpenUrl(p.id) });
    }
    drawPhotoPairs(d, images);
  }

  await drawSignatures(d, data, doc);

  drawContentsPage(d, contentsPage, d.outline);
  drawFrames(d, data, logo);
  return doc.save();
}
