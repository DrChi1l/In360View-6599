import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceLine } from "../database/schema";

const BRAND = rgb(0.071, 0.024, 0.361); // #12065C
const INK = rgb(0.23, 0.23, 0.23);
const RULE = rgb(0.82, 0.82, 0.86);

const money = (n: number) => `£${n.toFixed(2)}`;
const dmy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

export type InvoicePdfData = {
  number: string;
  clientName: string;
  clientAddress: string | null;
  issueDate: Date;
  lines: InvoiceLine[];
  total: number;
  paymentInfo: string[];
  logoBytes: Uint8Array | null;
};

/** A4 invoice laid out like the printed sample: logo, header, 5-column table, total, payment info. */
export async function buildInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${data.number}`);
  doc.setAuthor("In360View");
  doc.setCreator("In360View");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 50;
  const left = M;
  const right = W - M;
  const col = { rate: 330, qty: 410, total: 460 };
  const ROW = 26;
  const MIN_ROWS = 8;

  let page = doc.addPage([W, H]);
  const text = (t: string, x: number, y: number, size = 10, font = regular, spacing = 0) =>
    page.drawText(t, { x, y, size, font, color: INK, characterSpacing: spacing });
  const rightText = (t: string, x: number, y: number, size = 10, font = regular) =>
    text(t, x - font.widthOfTextAtSize(t, size), y, size, font);
  /** Truncates to a width so a long address never runs into the Rate column. */
  const fit = (t: string, max: number, size: number) => {
    let s = t;
    while (s.length > 1 && regular.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1);
    return s === t ? t : `${s.trimEnd()}…`;
  };

  if (data.logoBytes) {
    try {
      const logo = await doc.embedPng(data.logoBytes);
      const h = 44;
      page.drawImage(logo, { x: left, y: H - 40 - h, width: (logo.width / logo.height) * h, height: h });
    } catch {
      /* logo is optional */
    }
  }

  const title = "INVOICE";
  const titleSize = 28;
  const titleW = bold.widthOfTextAtSize(title, titleSize) + 6 * (title.length - 1);
  text(title, (W - titleW) / 2, H - 150, titleSize, bold, 6);

  let y = H - 215;
  text("ISSUED TO:", left, y, 10, bold, 1.5);
  const addr = [data.clientName, ...(data.clientAddress ?? "").split(/\n|,\s*/).filter(Boolean)];
  addr.slice(0, 5).forEach((l, i) => text(l, left, y - 16 - i * 14, 10, regular, 0.8));
  text("INVOICE NO:", right - 160, y, 10, bold, 1.5);
  rightText(data.number, right, y, 10, bold);
  rightText(`DATE:   ${dmy(data.issueDate)}`, right, y - 52, 10);

  const rowsFor = (n: number) => Math.max(n, MIN_ROWS);
  const header = (top: number) => {
    page.drawRectangle({ x: left, y: top - 34, width: right - left, height: 34, color: BRAND });
    const white = rgb(1, 1, 1);
    const h = (t: string, x: number) => page.drawText(t, { x, y: top - 23, size: 13, font: regular, color: white });
    h("Description", left + 34);
    h("Rate", col.rate);
    h("Qty", col.qty);
    h("Total", col.total);
    return top - 34;
  };

  let top = header(y - 105);
  const row = (n: number, l?: InvoiceLine) => {
    if (top - ROW < 80) {
      page = doc.addPage([W, H]);
      top = header(H - 60);
    }
    page.drawRectangle({ x: left, y: top - ROW, width: right - left, height: ROW, borderColor: RULE, borderWidth: 0.6 });
    text(`${n}.`, left + 6, top - 17, 8);
    if (l) {
      text(fit(l.description, col.rate - left - 44, 10), left + 34, top - 17, 10);
      text(money(l.rate), col.rate, top - 17, 11);
      text(String(l.qty), col.qty + 8, top - 17, 11);
      text(money(l.rate * l.qty), col.total, top - 17, 11);
    }
    top -= ROW;
  };
  for (let i = 0; i < rowsFor(data.lines.length); i++) row(i + 1, data.lines[i]);

  if (top < 160) {
    page = doc.addPage([W, H]);
    top = H - 80;
  }
  page.drawLine({ start: { x: left + 10, y: top - 8 }, end: { x: right, y: top - 8 }, thickness: 0.8, color: INK });
  text("TOTAL", col.qty - 40, top - 30, 10, bold, 1.5);
  text(money(data.total), col.total, top - 30, 10, bold);

  const payY = top - 80;
  text("PAYMENT INFO:", left, payY, 10, bold, 1.5);
  data.paymentInfo.forEach((l, i) => text(l, left, payY - 16 - i * 14, 10, regular, 0.8));

  return doc.save();
}
