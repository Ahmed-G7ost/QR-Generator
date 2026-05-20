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
  // QR Style
  qr_fg_color: "#000000",
  qr_bg_color: "#ffffff",
  qr_dot_style: "square",
  qr_eye_color: "",
  qr_use_gradient: false,
  qr_gradient_color1: "#000000",
  qr_gradient_color2: "#0066ff",
  qr_gradient_type: "linear",
  qr_logo: null,
  qr_logo_size: 20,
  qr_fg_image: null,
  qr_frame: false,
  qr_frame_color: "#000000",
  qr_frame_width: 2,
  qr_bg_shape: "none",
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
      // Client-side mode: store full records + count.
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

/* --------------------------------- App ---------------------------------- */
export default function App() {
  const [lang, setLang] = useState("ar");
  const t = useMemo(() => translations[lang], [lang]);
  const [mode, setMode] = useState("qr"); // "qr" | "cards"
  const [cardState, cardDispatch] = useReducer(cardReducer, cardInitial);
  const [activated, setActivated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const toggleLang = () => setLang((l) => (l === "ar" ? "en" : "ar"));

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  const goStep = useCallback((n) => cardDispatch({ type: "SET_STEP", payload: n }), []);

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
      className="min-h-screen relative overflow-x-clip bg-[#06060c] text-white"
      style={{ fontFamily: lang === "ar" ? "'Tajawal', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
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

      {/* Nav */}
      <header className="relative z-10 px-6 sm:px-10 pt-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            {/* Mode switcher */}
            <div className="flex rounded-xl overflow-hidden border border-white/15" data-testid="mode-switcher">
              <button
                data-testid="mode-qr-btn"
                onClick={() => setMode("qr")}
                className={`px-4 py-2 text-xs font-semibold transition-all ${
                  mode === "qr" ? "bg-gradient-to-r from-violet-500/80 to-cyan-400/80 text-white" : "bg-white/[0.04] text-white/50 hover:text-white/80"
                }`}
              >
                {t.modeQr}
              </button>
              <button
                data-testid="mode-cards-btn"
                onClick={() => setMode("cards")}
                className={`px-4 py-2 text-xs font-semibold transition-all ${
                  mode === "cards" ? "bg-gradient-to-r from-violet-500/80 to-cyan-400/80 text-white" : "bg-white/[0.04] text-white/50 hover:text-white/80"
                }`}
              >
                {t.modeCards}
              </button>
            </div>
            <button onClick={toggleLang} data-testid="lang-toggle"
              className="px-4 py-2 rounded-full text-xs font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition">
              {t.langToggle}
            </button>
            <button
              onClick={() => { signOut(_fbAuth).catch(() => {}); setActivated(false); setCurrentUser(null); }}
              className="px-4 py-2 rounded-full text-xs font-semibold border border-rose-400/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition"
              title={lang === "ar" ? "تسجيل خروج" : "Sign Out"}
            >
              {lang === "ar" ? "خروج" : "Sign Out"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 sm:px-10 pt-14 pb-10">
        <div className="max-w-6xl mx-auto">
          <span data-testid="badge-local"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] tracking-[0.22em] uppercase text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {mode === "qr" ? t.badge : "Excel · CSV · PDF · JPG · PNG"}
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight max-w-4xl">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300">
              {mode === "qr" ? t.headline : t.cardHeadline}
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/60 max-w-2xl">
            {mode === "qr" ? t.tagline : t.cardTagline}
          </p>
        </div>
      </section>

      {/* Main */}
      <main className="relative z-10 px-6 sm:px-10 pb-24">
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

      <footer className="relative z-10 px-6 sm:px-10 pb-10">
        <div className="max-w-6xl mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} A7D TEAM &middot; {t.allRights}</span>
          <span>{t.poweredBy} A7D TEAM</span>
        </div>
      </footer>
    </div>
  );
}
