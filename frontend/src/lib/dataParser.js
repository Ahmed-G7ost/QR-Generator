import * as XLSX from "xlsx";
import Papa from "papaparse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = rej;
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = rej;
    reader.readAsText(file, "utf-8");
  });
}

// ── Normalise a row object to {username, password} ─────────────────────────

function normaliseRow(row) {
  const keys = Object.keys(row);
  const lower = keys.reduce((m, k) => { m[k.toLowerCase().trim()] = row[k]; return m; }, {});

  const usernameKeys = ["username", "user", "يوزر", "اليوزر", "اسم المستخدم", "account", "login"];
  const passwordKeys = ["password", "pass", "باسورد", "الباسورد", "كلمة المرور", "pwd", "secret"];

  const uKey = usernameKeys.find((k) => lower[k] !== undefined);
  const pKey = passwordKeys.find((k) => lower[k] !== undefined);

  // Fallback: first two non-empty columns
  const vals = Object.values(lower).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");

  const username = String(uKey ? lower[uKey] : vals[0] ?? "").trim();
  const password = String(pKey ? lower[pKey] : vals[1] ?? "").trim();
  return username || password ? { username, password } : null;
}

// ── Excel parser ──────────────────────────────────────────────────────────

async function parseExcel(file) {
  const buf = await readFileAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(normaliseRow).filter(Boolean);
}

// ── CSV parser ────────────────────────────────────────────────────────────

async function parseCsv(file) {
  const text = await readFileAsText(file);
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data.map(normaliseRow).filter(Boolean));
      },
      error: reject,
    });
  });
}

// ── PDF parser ────────────────────────────────────────────────────────────

async function parsePdf(file) {
  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    lines.push(pageText);
  }

  // Parse username/password patterns
  const records = [];
  const combined = lines.join("\n");

  // Try to find pairs with common separators
  const patterns = [
    /(?:user(?:name)?|يوزر)[:\s]+(\S+)[^\n]*(?:pass(?:word)?|باسورد)[:\s]+(\S+)/gi,
    /(\S+)\s*[|,\t]\s*(\S+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(combined)) !== null) {
      if (match[1] && match[2]) {
        records.push({ username: match[1].trim(), password: match[2].trim() });
      }
    }
    if (records.length > 0) break;
  }

  // If still nothing, split by lines and try each line as "username password"
  if (records.length === 0) {
    const lineArr = combined.split(/[\n\r]+/);
    for (const line of lineArr) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        records.push({ username: parts[0], password: parts[1] });
      }
    }
  }

  return records.filter((r) => r.username && r.password);
}

// ── Main export ───────────────────────────────────────────────────────────

export async function parseDataFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (["xlsx", "xls"].includes(ext)) return parseExcel(file);
  if (ext === "csv") return parseCsv(file);
  if (ext === "pdf") return parsePdf(file);
  throw new Error("Unsupported file type: " + ext);
}

export function readTemplateImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => resolve({ url: e.target.result, width: img.width, height: img.height });
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
