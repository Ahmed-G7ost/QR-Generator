import { db } from "@/lib/firebase";
import { ref, push, set, get, update, serverTimestamp } from "firebase/database";

/* -------------------------------------------------------------------------- */
/*  Lightweight visitor analytics → Firebase Realtime Database                */
/*  Data is stored under `analytics/*` and read by the private /stats.html    */
/* -------------------------------------------------------------------------- */

const VISITOR_ID_KEY = "a7d_visitor_id";
const VISIT_FLAG_KEY = "a7d_visit_logged"; // sessionStorage: one visit per tab session

function getOrCreateVisitorId() {
  let id = "";
  try {
    id = localStorage.getItem(VISITOR_ID_KEY) || "";
  } catch (_) {}
  if (!id) {
    const rand =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    id = "vis_" + rand.slice(0, 24);
    try {
      localStorage.setItem(VISITOR_ID_KEY, id);
    } catch (_) {}
  }
  return id;
}

function todayStr() {
  // YYYY-MM-DD (local)
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function deviceMeta() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  let browser = "Other";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  let os = "Other";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return {
    userAgent: ua.slice(0, 250),
    platform: (typeof navigator !== "undefined" && navigator.platform) || "",
    language: (typeof navigator !== "undefined" && navigator.language) || "",
    browser,
    os,
    deviceType: isMobile ? "Mobile" : "Desktop",
    screen:
      typeof window !== "undefined" && window.screen
        ? `${window.screen.width}x${window.screen.height}`
        : "",
  };
}

async function fetchGeo() {
  // Free, no-key IP geolocation. Fails silently → "Unknown".
  try {
    const res = await fetch("https://ipwho.is/", { method: "GET" });
    const j = await res.json();
    if (j && j.success !== false) {
      return {
        country: j.country || "Unknown",
        countryCode: j.country_code || "",
        city: j.city || "",
        region: j.region || "",
        ip: j.ip || "",
      };
    }
  } catch (_) {}
  return { country: "Unknown", countryCode: "", city: "", region: "", ip: "" };
}

/**
 * Track a page visit. Logs once per browser-tab session.
 * Updates the per-visitor summary (firstSeen / lastSeen / visitCount).
 */
export async function trackVisit() {
  try {
    const visitorId = getOrCreateVisitorId();

    let alreadyLogged = false;
    try {
      alreadyLogged = sessionStorage.getItem(VISIT_FLAG_KEY) === "1";
    } catch (_) {}
    if (alreadyLogged) return;
    try {
      sessionStorage.setItem(VISIT_FLAG_KEY, "1");
    } catch (_) {}

    const meta = deviceMeta();
    const geo = await fetchGeo();
    const now = Date.now();
    const date = todayStr();

    // Per-visitor summary
    const visitorRef = ref(db, `analytics/visitors/${visitorId}`);
    const snap = await get(visitorRef);
    const isNew = !snap.exists();
    const prev = snap.exists() ? snap.val() : {};
    await update(visitorRef, {
      visitorId,
      firstSeen: prev.firstSeen || now,
      lastSeen: now,
      visitCount: (prev.visitCount || 0) + 1,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      browser: meta.browser,
      os: meta.os,
      deviceType: meta.deviceType,
    });

    // Visit event log
    await push(ref(db, "analytics/visits"), {
      visitorId,
      ts: now,
      serverTs: serverTimestamp(),
      date,
      isNew,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      region: geo.region,
      ...meta,
      referrer: (typeof document !== "undefined" && document.referrer) || "",
      path: (typeof window !== "undefined" && window.location.pathname) || "/",
    });

    // Daily counter
    const dayRef = ref(db, `analytics/daily/${date}`);
    const daySnap = await get(dayRef);
    const dayPrev = daySnap.exists() ? daySnap.val() : {};
    await set(dayRef, {
      date,
      visits: (dayPrev.visits || 0) + 1,
      newVisitors: (dayPrev.newVisitors || 0) + (isNew ? 1 : 0),
    });
  } catch (e) {
    // Never break the app because of analytics
    if (typeof console !== "undefined") console.warn("trackVisit failed", e);
  }
}

/**
 * Track a tool-usage event (e.g. "qr_generate", "card_generate").
 * meta is an optional small object with extra info (counts, etc).
 */
export async function trackEvent(action, meta = {}) {
  try {
    const visitorId = getOrCreateVisitorId();
    const now = Date.now();
    const date = todayStr();

    await push(ref(db, "analytics/events"), {
      visitorId,
      action,
      meta,
      ts: now,
      date,
    });

    // Aggregate counter per action
    const cRef = ref(db, `analytics/eventCounts/${action}`);
    const cSnap = await get(cRef);
    const cPrev = cSnap.exists() ? cSnap.val() : { count: 0 };
    await set(cRef, { action, count: (cPrev.count || 0) + 1, lastTs: now });

    // Per-visitor usage count
    const uRef = ref(db, `analytics/visitors/${visitorId}/usage/${action}`);
    const uSnap = await get(uRef);
    await set(uRef, (uSnap.exists() ? uSnap.val() : 0) + 1);
  } catch (e) {
    if (typeof console !== "undefined") console.warn("trackEvent failed", e);
  }
}
