import { useReducer, useMemo, useEffect, useCallback, useState } from "react";
import "@/App.css";
import { translations } from "@/lib/i18n";
import QrGenerator from "@/components/QrGenerator";
import CardUploadPhase from "@/components/CardUploadPhase";
import CardConfigurePhase from "@/components/CardConfigurePhase";
import CardGeneratePhase from "@/components/CardGeneratePhase";
import ActivationGate from "@/components/ActivationGate";
import QrCustomizer from "@/components/QrCustomizer";
import { QrStyleProvider } from "@/context/QrStyleContext";
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

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icons = {
  qr: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 4h3v3h-3v-3zm4-4h3v3h-3v-3zm0 7h3v-3h-3v3zm-4-7h3v3h-3v-3z" fill="currentColor" />
    </svg>
  ),
  cards: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  palette: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h2a2 2 0 0 0 2-2 10 10 0 0 0-8-13z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.5" fill="currentColor" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

/* ─── Logo ───────────────────────────────────────────────────────────────── */
const Logo = () => (
  <div className="flex items-center gap-2.5" data-testid="brand-logo">
    <div className="relative h-9 w-9 shrink-0">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 blur-sm opacity-70" />
      <div className="relative h-9 w-9 rounded-xl bg-[#0d0d18] border border-white/10 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 4h3v3h-3v-3zm4-4h3v3h-3v-3zm0 7h3v-3h-3v3zm-4-7h3v3h-3v-3z" fill="url(#g)" />
          <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
        </svg>
      </div>
    </div>
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] tracking-[0.3em] text-white/40 uppercase">A7D</span>
      <span className="text-sm font-bold text-white">QR Generator</span>
    </div>
  </div>
);

/* ─── Nav Item ───────────────────────────────────────────────────────────── */
const NavItem = ({ icon, label, active, onClick, testId, badge }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
      active
        ? "bg-gradient-to-r from-violet-500/20 to-cyan-400/10 border border-violet-400/30 text-white"
        : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
    }`}
  >
    <span className={`shrink-0 transition-colors ${active ? "text-cyan-300" : "text-white/40 group-hover:text-white/60"}`}>
      {icon}
    </span>
    <span className="flex-1 text-start">{label}</span>
    {badge && (
      <span className="px-1.5 py-0.5 rounded-full bg-violet-500/30 border border-violet-400/30 text-[10px] text-violet-200 font-bold">
        {badge}
      </span>
    )}
    {active && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />}
  </button>
);

/* ─── Card Reducer ───────────────────────────────────────────────────────── */
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
    case "SET_RECORDS_FULL": return { ...state, records: action.payload.records, recordsCount: action.payload.records.length };
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

/* ─── Card Stepper ───────────────────────────────────────────────────────── */
function CardStepper({ current, t }) {
  const steps = [
    { key: 1, label: t.step1Label },
    { key: 2, label: t.step2Label },
    { key: 3, label: t.step3Label },
  ];
  return (
    <div className="flex items-center gap-1.5 mb-8" data-testid="card-stepper">
      {steps.map((s, idx) => {
        const done = current > s.key;
        const active = current === s.key;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div data-testid={`card-step-${s.key}`}
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done ? "bg-emerald-400/80 text-[#0d0d18]"
                  : active ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white"
                  : "bg-white/10 text-white/40"
                }`}
              >
                {done ? "✓" : s.key}
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${active ? "text-white" : done ? "text-emerald-300/80" : "text-white/40"}`}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${done ? "bg-emerald-400/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────── */
export default function App() {
  const [lang, setLang] = useState("ar");
  const t = useMemo(() => translations[lang], [lang]);
  const [mode, setMode] = useState("qr"); // "qr" | "cards" | "customize"
  const [cardState, cardDispatch] = useReducer(cardReducer, cardInitial);
  const [activated, setActivated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleLang = () => setLang((l) => (l === "ar" ? "en" : "ar"));

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  const goStep = useCallback((n) => cardDispatch({ type: "SET_STEP", payload: n }), []);

  const isRtl = lang === "ar";

  if (!activated) {
    return (
      <ActivationGate
        lang={lang}
        onToggleLang={toggleLang}
        onActivated={(user) => { setCurrentUser(user); setActivated(true); }}
      />
    );
  }

  const navItems = [
    { id: "qr", icon: Icons.qr, label: t.modeQr },
    { id: "cards", icon: Icons.cards, label: t.modeCards },
  ];

  return (
    <QrStyleProvider>
      <div
        dir={t.dir}
        className="min-h-screen bg-[#06060c] text-white flex"
        style={{ fontFamily: lang === "ar" ? "'Tajawal', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        {/* Ambient background */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[160px]" />
          <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-cyan-500/15 blur-[160px]" />
          <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-fuchsia-500/10 blur-[160px]" />
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside
          data-testid="app-sidebar"
          className={`fixed top-0 ${isRtl ? "right-0" : "left-0"} h-screen w-60 z-20 flex flex-col border-${isRtl ? "l" : "r"} border-white/[0.06] bg-[#080810]/90 backdrop-blur-xl transition-transform duration-300 
            ${sidebarOpen ? "translate-x-0" : (isRtl ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0")}`}
        >
          {/* Logo */}
          <div className="px-4 py-5 border-b border-white/[0.06]">
            <Logo />
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.25em] text-white/25 font-semibold">
              {lang === "ar" ? "الأدوات" : "Tools"}
            </p>
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={mode === item.id}
                onClick={() => { setMode(item.id); setSidebarOpen(false); }}
                testId={`mode-${item.id}-btn`}
              />
            ))}

            {/* Separator */}
            <div className="my-3 border-t border-white/[0.06]" />

            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.25em] text-white/25 font-semibold">
              {lang === "ar" ? "التخصيص" : "Customize"}
            </p>
            <NavItem
              icon={Icons.palette}
              label={t.modeCustomize}
              active={mode === "customize"}
              onClick={() => { setMode("customize"); setSidebarOpen(false); }}
              testId="mode-customize-btn"
              badge={lang === "ar" ? "جديد" : "New"}
            />
          </nav>

          {/* Bottom: Lang + Sign out */}
          <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">
            {currentUser && (
              <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-white/30 truncate">{currentUser.email}</p>
              </div>
            )}
            <button onClick={toggleLang} data-testid="lang-toggle"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition border border-transparent">
              <span>{t.langToggle}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10">{lang.toUpperCase()}</span>
            </button>
            <button
              onClick={() => { signOut(_fbAuth).catch(() => {}); setActivated(false); setCurrentUser(null); }}
              data-testid="sign-out-btn"
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-300/70 hover:text-rose-300 hover:bg-rose-500/10 transition border border-transparent"
            >
              {Icons.logout}
              {lang === "ar" ? "تسجيل خروج" : "Sign Out"}
            </button>
          </div>
        </aside>

        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-10 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className={`flex-1 relative z-10 min-h-screen flex flex-col ${isRtl ? "lg:mr-60" : "lg:ml-60"}`}>
          {/* Top bar (mobile) */}
          <header className="lg:hidden sticky top-0 z-10 px-4 py-3 border-b border-white/[0.06] bg-[#080810]/80 backdrop-blur-xl flex items-center justify-between">
            <Logo />
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 px-6 sm:px-10 py-8 pb-16">
            {/* Hero section */}
            <section className="mb-8">
              <span data-testid="badge-local"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] tracking-[0.22em] uppercase text-white/60 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {mode === "qr" ? t.badge : mode === "cards" ? "Excel · CSV · PDF · JPG · PNG" : (lang === "ar" ? "تخصيص مظهر QR" : "QR Appearance Customization")}
              </span>
              <h1 className="text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight max-w-3xl">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300">
                  {mode === "qr" ? t.headline : mode === "cards" ? t.cardHeadline : t.qrCustomizer}
                </span>
              </h1>
              <p className="mt-4 text-sm sm:text-base text-white/55 max-w-2xl">
                {mode === "qr" ? t.tagline : mode === "cards" ? t.cardTagline : t.qrCustomizerDesc}
              </p>
            </section>

            {/* Mode content */}
            {mode === "qr" && <QrGenerator t={t} lang={lang} />}

            {mode === "cards" && (
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

            {mode === "customize" && <QrCustomizer t={t} lang={lang} />}
          </main>

          {/* Footer */}
          <footer className="px-6 sm:px-10 pb-8">
            <div className="pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
              <span>&copy; {new Date().getFullYear()} A7D TEAM &middot; {t.allRights}</span>
              <span>{t.poweredBy} A7D TEAM</span>
            </div>
          </footer>
        </div>
      </div>
    </QrStyleProvider>
  );
}
