/**
 * Donely weekly report card.
 *
 * Renders a standalone, print-quality PNG (1200 px wide, dynamic height) that
 * can be embedded inline in an email. This is a purpose-built report design —
 * it is NOT a screenshot of the weekly view.
 *
 * Visual identity: warm light background, navy primary, generous whitespace,
 * rounded stat blocks, hairline borders, no emoji.
 */

export type ReportRow = { label: string; value: number };

export type ReportInput = {
  /** Small wordmark at the top. */
  brand?: string;
  /** e.g. "Veckosammanställning" */
  title: string;
  /** e.g. "10–16 augusti" */
  range: string;
  rows: ReportRow[];
  total: number;
  /** e.g. "aktiviteter totalt" */
  totalLabel: string;
  /** Optional comment block. */
  comment?: string;
  commentHeading?: string;
  /** e.g. "Skapad med Donely" */
  footer: string;
};

const W = 1200;
const PAD = 96;

const NAVY = "#1e3a56";
const NAVY_SOFT = "#5b7690";
const BG = "#f4f1ec";
const CARD = "#ffffff";
const LINE = "#e3ddd4";

const SANS =
  '"Helvetica Neue", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

function font(weight: number, size: number) {
  return `${weight} ${size}px ${SANS}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Greedy word wrap that never exceeds `maxWidth`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrinks the font size until the text fits within `maxWidth`. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  size: number,
  min = 18,
) {
  let current = size;
  ctx.font = font(weight, current);
  while (ctx.measureText(text).width > maxWidth && current > min) {
    current -= 1;
    ctx.font = font(weight, current);
  }
  return current;
}

/**
 * Renders the report and returns a base64 PNG (no data URI prefix) plus its
 * dimensions. Returns null when no canvas is available (SSR).
 */
export function renderWeeklyReportPng(input: ReportInput): { base64: string; width: number; height: number } | null {
  if (typeof document === "undefined") return null;

  const rows = input.rows.filter((r) => r.value > 0);
  const cols = rows.length === 1 ? 1 : 2;
  const gap = 24;
  const innerW = W - PAD * 2;
  const blockW = cols === 1 ? innerW : (innerW - gap) / 2;
  const blockH = 200;
  const rowCount = Math.ceil(rows.length / cols);

  // --- measure comment (needs a context) -------------------------------
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  const comment = input.comment?.trim();
  let commentLines: string[] = [];
  if (comment) {
    measure.font = font(400, 30);
    commentLines = comment
      .split("\n")
      .flatMap((para) => (para.trim() ? wrap(measure, para.trim(), innerW - 80) : [""]));
  }

  const headerH = 96 + 92 + 46; // wordmark + title + range
  const gridH = rowCount * blockH + (rowCount - 1) * gap;
  const totalH = 210;
  const commentH = comment ? 44 + commentLines.length * 44 + 56 : 0;
  const H = Math.round(PAD + headerH + 56 + gridH + 48 + totalH + commentH + 96 + PAD * 0.5);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.textBaseline = "alphabetic";

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  let y = PAD;

  // Wordmark
  ctx.fillStyle = NAVY;
  ctx.font = font(700, 34);
  const brand = (input.brand ?? "DONELY").toUpperCase();
  const spaced = brand.split("").join("\u2009\u2009");
  ctx.fillText(spaced, PAD, y + 30);
  y += 96;

  // Title
  const titleSize = fitText(ctx, input.title, innerW, 700, 68, 40);
  ctx.fillStyle = NAVY;
  ctx.font = font(700, titleSize);
  ctx.fillText(input.title, PAD, y + titleSize * 0.78);
  y += 92;

  // Range
  ctx.fillStyle = NAVY_SOFT;
  ctx.font = font(400, 34);
  ctx.fillText(input.range, PAD, y + 26);
  y += 46;

  // Hairline
  y += 40;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 56 - 40 + 24;

  // Stat blocks
  rows.forEach((row, i) => {
    const col = cols === 1 ? 0 : i % cols;
    const line = Math.floor(i / cols);
    const x = PAD + col * (blockW + gap);
    const by = y + line * (blockH + gap);

    ctx.save();
    ctx.shadowColor = "rgba(30, 58, 86, 0.07)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = CARD;
    roundRect(ctx, x, by, blockW, blockH, 32);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    roundRect(ctx, x, by, blockW, blockH, 32);
    ctx.stroke();

    ctx.fillStyle = NAVY;
    ctx.font = font(700, 92);
    ctx.fillText(String(row.value), x + 40, by + 118);

    const labelSize = fitText(ctx, row.label, blockW - 80, 500, 32, 20);
    ctx.fillStyle = NAVY_SOFT;
    ctx.font = font(500, labelSize);
    ctx.fillText(row.label, x + 40, by + 162);
  });
  y += gridH + 48;

  // Total block
  ctx.fillStyle = NAVY;
  roundRect(ctx, PAD, y, innerW, totalH, 36);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = font(700, 108);
  ctx.fillText(String(input.total), PAD + 48, y + 120);
  const totalLabelSize = fitText(ctx, input.totalLabel, innerW - 96, 500, 34, 22);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = font(500, totalLabelSize);
  ctx.fillText(input.totalLabel, PAD + 48, y + 168);
  y += totalH;

  // Comment
  if (comment) {
    y += 56;
    if (input.commentHeading) {
      ctx.fillStyle = NAVY_SOFT;
      ctx.font = font(600, 26);
      ctx.fillText(input.commentHeading.toUpperCase(), PAD, y);
    }
    y += 20;
    ctx.fillStyle = NAVY;
    ctx.font = font(400, 30);
    commentLines.forEach((l, i) => ctx.fillText(l, PAD, y + 34 + i * 44));
    y += commentLines.length * 44;
  }

  // Footer
  ctx.fillStyle = "#9aa7b3";
  ctx.font = font(400, 24);
  ctx.fillText(input.footer, PAD, H - PAD * 0.5 - 6);

  const dataUrl = canvas.toDataURL("image/png");
  return { base64: dataUrl.split(",")[1] ?? "", width: W, height: H };
}
