import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { generateStyledQRBytes, DEFAULT_QR_STYLE } from "./qrStyler";

// ── Phase constants ───────────────────────────────────────────────────────────

export const PHASES = {
  PREPARING: "preparing",
  RENDERING: "rendering",
  SAVING: "saving",
  DONE: "done",
};

// ── Download helper ───────────────────────────────────────────────────────────

export function downloadPdfBlob(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Image loader ──────────────────────────────────────────────────────────────

function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

// ── Colour helper ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

// ── Main card PDF generator ───────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {Array}  opts.records         [{username, password}, ...]
 * @param {File}   opts.templateFile    image file (JPG/PNG)
 * @param {object} opts.config          card config
 * @param {File}   [opts.customFontFile]
 * @param {object} [opts.qrStyle]       QR style settings
 * @param {Function} opts.onProgress
 */
export async function generateCardsPdf({
  records,
  templateFile,
  config,
  customFontFile = null,
  qrStyle = DEFAULT_QR_STYLE,
  onProgress,
}) {
  const report = (phase, percent) => onProgress?.({ phase, percent });

  report(PHASES.PREPARING, 5);

  // ── 1. Parse grid config ──────────────────────────────────────────────────
  const [colsStr, rowsStr] = config.grid.split("x");
  const cols = parseInt(colsStr, 10);
  const rows = parseInt(rowsStr, 10);
  const cardsPerPage = cols * rows;

  // ── 2. Load template image ────────────────────────────────────────────────
  const templateBytes = await readFileAsArrayBuffer(templateFile);
  const ext = templateFile.name.split(".").pop().toLowerCase();
  const isJpg = ["jpg", "jpeg"].includes(ext);

  // ── 3. Get template dimensions ────────────────────────────────────────────
  const imgDimensions = await new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(templateFile);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  const templateW = imgDimensions.width;
  const templateH = imgDimensions.height;

  // Card cell size in points (1 pt ≈ 1 px here)
  const cellW = templateW / cols;
  const cellH = templateH / rows;

  // A4-ish page
  const pageW = templateW;
  const pageH = templateH;

  report(PHASES.PREPARING, 15);

  // ── 4. Create PDF document ────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Font loading
  let font;
  if (customFontFile) {
    try {
      const fontBytes = await readFileAsArrayBuffer(customFontFile);
      font = await pdfDoc.embedFont(new Uint8Array(fontBytes));
    } catch {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // ── 5. Pre-generate all QR codes ─────────────────────────────────────────
  const qrCache = {};
  if (config.show_qr) {
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      let qrText = "";
      switch (config.qr_content) {
        case "password":
          qrText = rec.password;
          break;
        case "both":
          qrText = `${rec.username}:${rec.password}`;
          break;
        case "link":
          qrText = `${config.server_address || "http://192.168.1.1"}/login?username=${encodeURIComponent(rec.username)}&password=${encodeURIComponent(rec.password)}`;
          break;
        default: // username
          qrText = rec.username;
      }
      qrCache[i] = await generateStyledQRBytes(qrText, qrStyle, 200);
      if (i % 10 === 0) {
        report(PHASES.RENDERING, 15 + Math.round((i / records.length) * 25));
      }
    }
  }

  report(PHASES.RENDERING, 40);

  // ── 6. Render pages ───────────────────────────────────────────────────────
  const numPages = Math.ceil(records.length / cardsPerPage);

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const page = pdfDoc.addPage([pageW, pageH]);

    // Draw template as background
    let templateImg;
    try {
      if (isJpg) {
        templateImg = await pdfDoc.embedJpg(new Uint8Array(templateBytes));
      } else {
        templateImg = await pdfDoc.embedPng(new Uint8Array(templateBytes));
      }
      page.drawImage(templateImg, { x: 0, y: 0, width: pageW, height: pageH });
    } catch {
      // Continue without template image
    }

    // Draw each card on this page
    for (let cardIdx = 0; cardIdx < cardsPerPage; cardIdx++) {
      const globalIdx = pageIdx * cardsPerPage + cardIdx;
      if (globalIdx >= records.length) break;

      const rec = records[globalIdx];
      const cardCol = cardIdx % cols;
      const cardRow = Math.floor(cardIdx / cols);

      // Card top-left (PDF coords: y=0 is bottom)
      const cardX = cardCol * cellW;
      const cardY = pageH - (cardRow + 1) * cellH;

      // Helper: convert % position to absolute coords within cell
      const absX = (pct) => cardX + (pct / 100) * cellW;
      const absY = (pct) => cardY + ((100 - pct) / 100) * cellH;

      const drawText = (text, xPct, yPct, fontSize, color) => {
        const sz = Math.max(4, Math.min(fontSize, 72));
        try {
          page.drawText(String(text), {
            x: absX(xPct) - (font.widthOfTextAtSize(String(text), sz) / 2),
            y: absY(yPct) - sz / 2,
            size: sz,
            font,
            color: hexToRgb(color || "#000000"),
          });
        } catch {
          // Skip problematic text
        }
      };

      // Username
      drawText(rec.username, config.username_x, config.username_y, config.username_font_size, config.username_color);

      // Password
      drawText(rec.password, config.password_x, config.password_y, config.password_font_size, config.password_color);

      // Date
      if (config.show_date && config.date_text) {
        const dateDisplay = config.show_counter
          ? `${config.date_text}/${globalIdx + 1}`
          : config.date_text;
        drawText(dateDisplay, config.date_x, config.date_y, config.date_font_size, config.date_color);
      }

      // Label
      if (config.label_text) {
        drawText(config.label_text, config.label_x, config.label_y, config.label_font_size, config.label_color);
      }

      // QR code
      if (config.show_qr && qrCache[globalIdx]) {
        const qrSizePx = (config.qr_size / 100) * Math.min(cellW, cellH);
        const qrX = absX(config.qr_x) - qrSizePx / 2;
        const qrY = absY(config.qr_y) - qrSizePx / 2;
        try {
          const qrImg = await pdfDoc.embedPng(qrCache[globalIdx]);
          page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSizePx, height: qrSizePx });
        } catch {
          // Skip failed QR
        }
      }
    }

    report(PHASES.RENDERING, 40 + Math.round((pageIdx / numPages) * 45));
  }

  // ── 7. Save ───────────────────────────────────────────────────────────────
  report(PHASES.SAVING, 90);

  const pdfBytes = await pdfDoc.save();
  const fileSizeKb = Math.round(pdfBytes.byteLength / 1024);
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `cards_${ts}.pdf`;

  report(PHASES.DONE, 100);

  return {
    pdfBytes,
    filename,
    totalRecords: records.length,
    totalPages: numPages,
    fileSizeKb,
  };
}
