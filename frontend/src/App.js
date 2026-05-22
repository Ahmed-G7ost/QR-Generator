import { useReducer, useMemo, useEffect, useCallback, useState } from "react";
import "@/App.css";
import { translations } from "@/lib/i18n";
import QrGenerator from "@/components/QrGenerator";
import CardUploadPhase from "@/components/CardUploadPhase";
import CardConfigurePhase from "@/components/CardConfigurePhase";
import CardGeneratePhase from "@/components/CardGeneratePhase";
import ActivationGate from "@/components/ActivationGate";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";

const _fbConfig = {
  apiKey: "AIzaSyD2Bd0m6Kd7DcvFZyNBlIKk1rXZrYjeo0o",
  authDomain: "a7d-qr-generator.firebaseapp.com",
  databaseURL: "https://a7d-qr-generator-default-rtdb.firebaseio.com",
  projectId: "a7d-qr-generator",
  storageBucket: "a7d-qr-generator.firebasestorage.app",
  messagingSenderId: "607575246036",
  appId: "1:607575246036:web:0c25f6434a3a946bc1a741",
};
const _fbApp = getApps().length === 0 ? initializeApp(_fbConfig) : getApps()[0];
const _fbAuth = getAuth(_fbApp);

/* --------------------------------- Logo --------------------------------- */
const Logo = () => (
  <div className="flex items-center gap-3" data-testid="brand-logo">
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 blur-md opacity-70" />
      <div className="relative h-10 w-10 rounded-xl bg-[#0d0d18] border border-white/10 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 4h3v3h-3v-3zm4-4h3v3h-3v-3zm0 7h3v-3h-3v3zm-4-7h3v3h-3v-3z" fill="url(#g)" />
          <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
        </svg>
      </div>
    </div>
    <div className="flex flex-col leading-tight">
      <span className="text-[11px] tracking-[0.3em] text-white/50 uppercase">A7D</span>
      <span className="text-base font-bold text-white">Cards &amp; QR Generator</span>
    </div>
  </div>
);

/* ------------------------------ Card State ------------------------------- */
const DEFAULT_CONFIG = {
  grid: "4x8", show_date: false, date_text: "", label_text: "",
  username_font_size: 14, password_font_size: 12, date_font_size: 10, label_font_size: 12,
  username_x: 50, username_y: 40, password_x: 50, password_y: 60,
  date_x: 50, date_y: 85, label_x: 50, label_y: 10,
  username_color: "#000000", password_color: "#000000",
  date_color: "#000000", label_color: "#000000",
  show_counter: true,
  show_qr: false, qr_x: 50, qr_y: 75, qr_size: 25,
  qr_content: "username",
  custom_font: null,
};

const cardInitial = {
  step: 1, sessionId: null, records: [], recordsCount: 0,
  dataFile: null, templateFile: null, templateUrl: null, templateDimensions: null,
  config: { ...DEFAULT_CONFIG }, uploading: false, error: null,
};

function cardReducer(state, action) {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.payload };
    case "SET_SESSION": return { ...state, sessionId: action.payload };
    case "SET_RECORDS": return { ...state, records: action.payload.records, recordsCount: action.payload.count };
    case "SET_RECORDS_FULL":
      return {
        ...state,
        records: action.payload.records,
        recordsCount: action.payload.records.length,
      };
    case "SET_DATA_FILE": return { ...state, dataFile: action.payload };
    case "SET_TEMPLATE_FILE": return { ...state, templateFile: action.payload };
    case "SET_TEMPLATE_INFO": return { ...state, templateDimensions: action.payload.dimensions, templateUrl: action.payload.url };
    case "UPDATE_CONFIG": return { ...state, config: { ...state.config, ...action.payload } };
    case "SET_UPLOADING": return { ...state, uploading: action.payload };
    case "SET_ERROR": return { ...state, error: action.payload };
    case "RESET": return { ...cardInitial };
    default: return state;
  }
}

/* ------------------------------- Stepper --------------------------------- */
function CardStepper({ current, t }) {
  const steps = [
    { key: 1, label: t.step1Label },
    { key: 2, label: t.step2Label },
    { key: 3, label: t.step3Label },
  ];
  return (
    <div className="flex items-center gap-1 mb-8" data-testid="card-stepper">
      {steps.map((s, idx) => {
        const done = current > s.key;
        const active = current === s.key;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div data-testid={`card-step-${s.key}`}
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all flex-shrink-0 ${
                  done ? "bg-emerald-400/80 text-[#0d0d18]"
                  : active ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white"
                  : "bg-white/10 text-white/40"
                }`}
              >
                {done ? "✓" : s.key}
              </div>
              <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${active ? "text-white" : done ? "text-emerald-300/80" : "text-white/40"}`}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 sm:mx-3 ${done ? "bg-emerald-400/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------- Sidebar Nav Items -------------------------- */
function SidebarContent({ mode, setMode, t, lang, onSignOut, onToggleLang, onClose }) {
  const handleNav = (m) => { setMode(m); onClose && onClose(); };
  return (
    <>
      {/* Logo */}
      <div className="px-3 mb-8">
        <Logo />
      </div>

      {/* Nav label */}
      <p className="px-3 mb-2 text-[10px] tracking-[0.25em] uppercase text-white/30 font-semibold">
        {lang === "ar" ? "الأدوات" : "Tools"}
      </p>

      {/* Nav items */}
      <nav className="flex flex-col gap-1" data-testid="mode-switcher">
        {/* QR Generator */}
        <button
          data-testid="mode-qr-btn"
          onClick={() => handleNav("qr")}
          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-start ${
            mode === "qr"
              ? "bg-gradient-to-r from-violet-500/25 to-cyan-400/15 text-white border border-violet-400/25"
              : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-all ${
            mode === "qr" ? "bg-gradient-to-br from-violet-500 to-cyan-400" : "bg-white/[0.06] group-hover:bg-white/[0.1]"
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 4h3v3h-3v-3zm4-4h3v3h-3v-3zm0 7h3v-3h-3v3zm-4-7h3v3h-3v-3z"
                fill={mode === "qr" ? "#fff" : "currentColor"} />
            </svg>
          </span>
          <span className="leading-tight">{t.modeQr}</span>
          {mode === "qr" && (
            <span className="ms-auto h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
          )}
        </button>

        {/* Card Extractor */}
        <button
          data-testid="mode-cards-btn"
          onClick={() => handleNav("cards")}
          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-start ${
            mode === "cards"
              ? "bg-gradient-to-r from-violet-500/25 to-cyan-400/15 text-white border border-violet-400/25"
              : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
          }`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-all ${
            mode === "cards" ? "bg-gradient-to-br from-violet-500 to-cyan-400" : "bg-white/[0.06] group-hover:bg-white/[0.1]"
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke={mode === "cards" ? "#fff" : "currentColor"} strokeWidth="1.8" />
              <path d="M2 10h20" stroke={mode === "cards" ? "#fff" : "currentColor"} strokeWidth="1.8" />
              <path d="M6 15h4M6 17.5h2" stroke={mode === "cards" ? "#fff" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" />
              <rect x="14" y="13" width="5" height="4" rx="0.8" fill={mode === "cards" ? "#fff" : "currentColor"} opacity="0.7" />
            </svg>
          </span>
          <span className="leading-tight">{t.modeCards}</span>
          {mode === "cards" && (
            <span className="ms-auto h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
          )}
        </button>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="flex flex-col gap-2 px-0">
        <button onClick={onToggleLang} data-testid="lang-toggle"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/60 hover:text-white/90 transition w-full text-start">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 3c-2.5 3-4 5.7-4 9s1.5 6 4 9M12 3c2.5 3 4 5.7 4 9s-1.5 6-4 9M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          {t.langToggle}
        </button>

        <button
          onClick={onSignOut}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold border border-rose-400/15 bg-rose-500/[0.06] text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-200 transition w-full text-start"
          title={lang === "ar" ? "تسجيل خروج" : "Sign Out"}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 12H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          {lang === "ar" ? "خروج" : "Sign Out"}
        </button>
      </div>
    </>
  );
}

/* ------------------------------ Desktop Sidebar -------------------------- */
function DesktopSidebar({ mode, setMode, t, lang, onSignOut, onToggleLang }) {
  return (
    <aside
      className="hidden lg:flex fixed top-0 bottom-0 z-20 flex-col py-6 px-3 border-white/[0.07] bg-[#08080f]/80 backdrop-blur-xl"
      style={{
        width: 220,
        left: lang === "ar" ? "auto" : 0,
        right: lang === "ar" ? 0 : "auto",
        borderRightWidth: lang === "ar" ? 0 : 1,
        borderLeftWidth: lang === "ar" ? 1 : 0,
        borderStyle: "solid",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <SidebarContent
        mode={mode} setMode={setMode} t={t} lang={lang}
        onSignOut={onSignOut} onToggleLang={onToggleLang}
      />
    </aside>
  );
}

/* ------------------------------ Mobile Drawer ---------------------------- */
function MobileDrawer({ open, onClose, mode, setMode, t, lang, onSignOut, onToggleLang }) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />
      {/* Drawer panel */}
      <aside
        className={`lg:hidden fixed top-0 bottom-0 z-40 flex flex-col py-6 px-3 bg-[#0d0d1a] w-[260px] transition-transform duration-300 ease-in-out shadow-2xl`}
        style={{
          left: lang === "ar" ? "auto" : 0,
          right: lang === "ar" ? 0 : "auto",
          transform: open
            ? "translateX(0)"
            : lang === "ar" ? "translateX(100%)" : "translateX(-100%)",
          borderRightWidth: lang === "ar" ? 0 : 1,
          borderLeftWidth: lang === "ar" ? 1 : 0,
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition"
          style={{ left: lang === "ar" ? "auto" : "auto", right: lang === "ar" ? "auto" : 12, left: lang === "ar" ? 12 : "auto" }}
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <SidebarContent
          mode={mode} setMode={setMode} t={t} lang={lang}
          onSignOut={onSignOut} onToggleLang={onToggleLang}
          onClose={onClose}
        />
      </aside>
    </>
  );
}

/* --------------------------------- App ---------------------------------- */
export default function App() {
  const [lang, setLang] = useState("ar");
  const t = useMemo(() => translations[lang], [lang]);
  const [mode, setMode] = useState("qr");
  const [cardState, cardDispatch] = useReducer(cardReducer, cardInitial);
  const [activated, setActivated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleLang = () => setLang((l) => (l === "ar" ? "en" : "ar"));

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  const goStep = useCallback((n) => cardDispatch({ type: "SET_STEP", payload: n }), []);

  const sidebarWidth = 220;

  const sidebarProps = {
    mode, setMode, t, lang,
    onToggleLang: toggleLang,
    onSignOut: () => { signOut(_fbAuth).catch(() => {}); setActivated(false); setCurrentUser(null); },
  };

  if (!activated) {
    return (
      <ActivationGate
        lang={lang}
        onToggleLang={toggleLang}
        onActivated={(user) => { setCurrentUser(user); setActivated(true); }}
      />
    );
  }

  return (
    <div
      dir={t.dir}
      className="min-h-screen relative bg-[#06060c] text-white"
      style={{ fontFamily: lang === "ar" ? "'Tajawal', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-violet-600/30 blur-[140px]" />
        <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-cyan-500/25 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Desktop Sidebar — hidden on mobile */}
      <DesktopSidebar {...sidebarProps} />

      {/* Mobile Drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        {...sidebarProps}
      />

      {/* Page content */}
      <div
        className="relative z-10 flex flex-col min-h-screen overflow-x-clip"
        style={{
          marginLeft: lang === "ar" ? 0 : "var(--sidebar-offset, 0px)",
          marginRight: lang === "ar" ? "var(--sidebar-offset, 0px)" : 0,
        }}
      >
        {/* inject CSS var for sidebar offset only on lg+ */}
        <style>{`@media (min-width: 1024px) { :root { --sidebar-offset: ${sidebarWidth}px; } }`}</style>

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#08080f]/90 backdrop-blur-xl border-b border-white/[0.07]">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white transition"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <Logo />
          <div style={{ width: 36 }} /> {/* spacer to center logo */}
        </header>

        {/* Hero */}
        <section className="px-4 sm:px-8 lg:px-10 pt-8 lg:pt-10 pb-6 lg:pb-10">
          <div className="max-w-6xl mx-auto">
            <span data-testid="badge-local"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] sm:text-[11px] tracking-[0.18em] sm:tracking-[0.22em] uppercase text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {mode === "qr" ? t.badge : "Excel · CSV · PDF · JPG · PNG"}
            </span>
            <h1 className="mt-4 sm:mt-6 text-3xl sm:text-4xl lg:text-6xl font-bold leading-[1.05] tracking-tight max-w-4xl">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300">
                {mode === "qr" ? t.headline : t.cardHeadline}
              </span>
            </h1>
            <p className="mt-3 sm:mt-5 text-sm sm:text-base lg:text-lg text-white/60 max-w-2xl">
              {mode === "qr" ? t.tagline : t.cardTagline}
            </p>
          </div>
        </section>

        {/* Main */}
        <main className="px-4 sm:px-8 lg:px-10 pb-20 sm:pb-24 flex-1">
          <div className="max-w-6xl mx-auto">
            {mode === "qr" ? (
              <QrGenerator t={t} lang={lang} />
            ) : (
              <div>
                <CardStepper current={cardState.step} t={t} />
                {cardState.step === 1 && (
                  <CardUploadPhase t={t} lang={lang} state={cardState} dispatch={cardDispatch} onNext={() => goStep(2)} />
                )}
                {cardState.step === 2 && (
                  <CardConfigurePhase t={t} lang={lang} state={cardState} dispatch={cardDispatch} onNext={() => goStep(3)} onBack={() => goStep(1)} />
                )}
                {cardState.step === 3 && (
                  <CardGeneratePhase t={t} lang={lang} state={cardState} dispatch={cardDispatch} onBack={() => goStep(2)} onReset={() => cardDispatch({ type: "RESET" })} />
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="px-4 sm:px-8 lg:px-10 pb-8 sm:pb-10">
          <div className="max-w-6xl mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <span>&copy; {new Date().getFullYear()} A7D TEAM &middot; {t.allRights}</span>
            <span>{t.poweredBy} A7D TEAM</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
