/**
 * Client-side parser for source data files (Excel / CSV / PDF).
 * Mirrors the backend logic in /api/upload/data 1:1 but runs entirely in browser.
 *
 * Output shape: [{ username: string, password: string }, ...]
 */
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import * as XLSX from "xlsx";
import Papa from "papaparse";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.js`;

/* ------------------------------ PDF parsing ------------------------------ */
/**
 * Smart PDF parser — detects username & password digit-lengths automatically
 * by analysing the structure of consecutive numeric rows. The longer column
 * is treated as usernames, the shorter as passwords. Date rows (years 19xx /
 * 20xx) are ignored.
 */
async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Collect every "token" with its (x, y) so we can reconstruct columns.
  const allTokens = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      const str = (it.str || "").trim();
      if (!str) continue;
      // pdf.js transform: [a, b, c, d, e, f] where (e, f) is position.
      const x = it.transform[4];
      const y = it.transform[5];
      allTokens.push({ str, x, y, page: p });
    }
  }

  // Extract numeric tokens only (used for username/password detection).
  const numericTokens = allTokens.filter((t) => /^\d+$/.test(t.str));

  if (numericTokens.length === 0) {
    throw new Error("لم يتم العثور على أرقام في ملف PDF.");
  }

  // Build a histogram of digit-lengths → most frequent two lengths are
  // username & password. Skip lengths 4 (typical year) when other lengths win.
  const lengthCounts = {};
  for (const t of numericTokens) {
    const L = t.str.length;
    lengthCounts[L] = (lengthCounts[L] || 0) + 1;
  }

  // Filter out year-like lengths (4 digits starting with 19/20) if better
  // options exist.
  const filteredLengths = Object.entries(lengthCounts).filter(([L]) => {
    const len = parseInt(L);
    if (len < 3) return false;
    if (len === 4) {
      // Treat as year if every 4-digit number starts with 19 or 20.
      const fours = numericTokens.filter((t) => t.str.length === 4);
      const yearLike = fours.filter((t) => /^(19|20)\d{2}$/.test(t.str)).length;
      return yearLike / fours.length < 0.7;
    }
    return true;
  });

  if (filteredLengths.length < 2) {
    // Fall back to simple regex for 12-digit / 6-digit case (legacy support).
    return legacyRegexParse(allTokens);
  }

  // Pick the two most frequent lengths.
  filteredLengths.sort((a, b) => b[1] - a[1]);
  const [lenA, lenB] = [parseInt(filteredLengths[0][0]), parseInt(filteredLengths[1][0])];
  const userLen = Math.max(lenA, lenB);
  const passLen = Math.min(lenA, lenB);

  const usernames = numericTokens.filter((t) => t.str.length === userLen);
  const passwords = numericTokens.filter((t) => t.str.length === passLen);

  const n = Math.min(usernames.length, passwords.length);
  if (n === 0) {
    throw new Error("لم يتم العثور على أزواج صالحة (اسم مستخدم / كلمة مرور).");
  }

  const records = [];
  for (let i = 0; i < n; i++) {
    records.push({ username: usernames[i].str, password: passwords[i].str });
  }
  return records;
}

function legacyRegexParse(allTokens) {
  const txt = allTokens.map((t) => t.str).join(" ");
  const usernames = txt.match(/\b\d{12}\b/g) || [];
  const passwords = txt.match(/\b\d{6}\b/g) || [];
  const n = Math.min(usernames.length, passwords.length);
  const records = [];
  for (let i = 0; i < n; i++) {
    records.push({ username: usernames[i], password: passwords[i] });
  }
  return records;
}

/* --------------------------- Excel / CSV parsing ------------------------- */
async function parseExcel(file) {
  const buf = await file.arrayBuffer();
  // Use cellText:true so XLSX preserves the formatted text of each cell
  // (avoids floating-point corruption of long numeric IDs like 12-digit usernames).
  // cellDates:false prevents date serial numbers from being parsed incorrectly.
  const wb = XLSX.read(buf, { type: "array", cellText: true, cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // raw:false  → use the formatted text (.w) instead of the raw JS number (.v)
  // defval:""  → fill empty cells with an empty string
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  return rowsToRecords(rows);
}

async function parseCsv(file) {
  const text = await file.text();
  const parsed = Papa.parse(text, { skipEmptyLines: true });
  return rowsToRecords(parsed.data);
}

function rowsToRecords(rows) {
  if (!rows || rows.length === 0) return [];

  // Detect header row by checking if first row contains user/pass keywords.
  const first = rows[0].map((c) => String(c).toLowerCase().trim());
  const userKeywords = ["user", "اسم", "name", "username"];
  const passKeywords = ["pass", "كلمة", "pwd", "password"];

  let userIdx = first.findIndex((c) => userKeywords.some((k) => c.includes(k)));
  let passIdx = first.findIndex((c) => passKeywords.some((k) => c.includes(k)));

  let dataRows = rows;
  if (userIdx !== -1 || passIdx !== -1) {
    dataRows = rows.slice(1);
    if (userIdx === -1) userIdx = 0;
    if (passIdx === -1) passIdx = 1;
  } else {
    userIdx = 0;
    passIdx = 1;
  }

  const records = [];
  for (const r of dataRows) {
    // Strip commas/spaces that Excel may add when formatting large numbers
    // e.g. "1,234,567,890" → "1234567890"
    const u = String(r[userIdx] ?? "").trim().replace(/[\s,]/g, "");
    const p = String(r[passIdx] ?? "").trim().replace(/[\s,]/g, "");
    if (u && u !== "nan") {
      records.push({ username: u, password: p === "nan" ? "" : p });
    }
  }
  return records;
}

/* --------------------------------- API ----------------------------------- */
export async function parseDataFile(file) {
  if (!file) throw new Error("لم يتم اختيار ملف.");
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseExcel(file);
  if (name.endsWith(".csv")) return parseCsv(file);
  throw new Error("صيغة غير مدعومة. استخدم Excel (.xlsx) أو CSV أو PDF.");
}

export async function readTemplateImage(file) {
  if (!file) throw new Error("لم يتم اختيار ملف صورة.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["jpg", "jpeg", "png"].includes(ext)) {
    throw new Error("صيغة صورة غير مدعومة. استخدم JPG أو PNG.");
  }
  const url = URL.createObjectURL(file);
  const dims = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
  return { url, width: dims.width, height: dims.height, ext };
}
