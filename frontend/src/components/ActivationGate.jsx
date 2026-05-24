import { useState, useCallback, useEffect, useMemo } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, get, update } from "firebase/database";

/* ---------- Firebase init ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyD2Bd0m6Kd7DcvFZyNBlIKk1rXZrYjeo0o",
  authDomain: "a7d-qr-generator.firebaseapp.com",
  databaseURL: "https://a7d-qr-generator-default-rtdb.firebaseio.com",
  projectId: "a7d-qr-generator",
  storageBucket: "a7d-qr-generator.firebasestorage.app",
  messagingSenderId: "607575246036",
  appId: "1:607575246036:web:0c25f6434a3a946bc1a741",
  measurementId: "G-9W7S8TZ5XF",
};

const firebaseApp =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

/* ---------- Security Config ---------- */
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

/* ---------- Device Lock helpers ---------- */
const DEVICE_ID_KEY = "a7d_device_id";
function getOrCreateDeviceId() {
  let id = "";
  try {
    id = localStorage.getItem(DEVICE_ID_KEY) || "";
  } catch (_) {}
  if (!id) {
    const rand = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    id = "dev_" + rand.slice(0, 24);
    try { localStorage.setItem(DEVICE_ID_KEY, id); } catch (_) {}
  }
  return id;
}
function getDeviceInfo() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";
  return {
    userAgent: ua.slice(0, 250),
    platform: (typeof navigator !== "undefined" && navigator.platform) ? navigator.platform : "",
    language: (typeof navigator !== "undefined" && navigator.language) ? navigator.language : "",
  };
}

/* ---------- Icons ---------- */
const Icon = {
  shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9.5 12.5l2 2 3.5-4" />
    </svg>
  ),
  user: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  lock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  ),
  eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  whatsapp: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M20.5 3.5A11 11 0 0 0 3.1 17l-1.6 5.5 5.7-1.5A11 11 0 1 0 20.5 3.5zM12 20.4a8.5 8.5 0 0 1-4.3-1.2l-.3-.2-3.4.9.9-3.3-.2-.3a8.5 8.5 0 1 1 7.3 4.1zm4.7-6.4c-.3-.1-1.5-.7-1.8-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8.9-.2.2-.3.2-.6.1-1.5-.8-2.5-1.4-3.5-3.1-.3-.5.3-.4.7-1.4.1-.2 0-.3 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.5 0 1.4 1.1 2.8 1.2 3 .2.2 2.1 3.3 5.2 4.6 1.8.7 2.5.8 3.4.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.2-.3-.3-.5-.4z" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  sparkle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7L19 17z" />
    </svg>
  ),
  infinity: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M18.6 6.6a5.4 5.4 0 1 0 0 10.8c1.6 0 3-.7 4-1.8L12 12 9.4 9.4a5.4 5.4 0 1 0 0 5.2L12 12l10.6 3.6c-1 1.1-2.4 1.8-4 1.8" />
    </svg>
  ),
  spinner: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}
      style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
};

/* ---------- Component ---------- */
export default function ActivationGate({ onActivated, lang = "ar", onToggleLang }) {
  const isAr = lang === "ar";

  const t = useMemo(() => (isAr
    ? {
        title: "تسجيل الدخول",
        subtitle: "أدخل بياناتك للوصول إلى البرنامج",
        emailLabel: "البريد الإلكتروني",
        emailPlaceholder: "example@email.com",
        passwordLabel: "كلمة المرور",
        passwordPlaceholder: "••••••••",
        login: "دخول",
        loggingIn: "جاري التحقق...",
        invalidCreds: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        accountDisabled: "هذا الحساب موقوف. تواصل مع الدعم.",
        deviceMismatch: "هذا الحساب مفعّل على جهاز آخر. تواصل مع الدعم لإعادة تعيين الجهاز.",
        networkError: "خطأ في الاتصال. تحقق من الإنترنت وحاول مجدداً.",
        genericError: "حدث خطأ ما. حاول مجدداً.",
        success: "تم تسجيل الدخول بنجاح، جاري فتح البرنامج...",
        whatsappBtn: "تواصل عبر واتساب",
        footerLine: "© A7D TEAM — جميع الحقوق محفوظة",
        secured: "مشفر ومحمي · Firebase Auth",
        langBtn: "English",
        noAccount: "لا تملك حساباً؟ تواصل مع الدعم",
        subBadge: "عرض حصري",
        subTitle: "اشتراك مدى الحياة",
        subSubtitle: "دفعة واحدة فقط، استخدم البرنامج بكامل ميزاته للأبد",
        priceCurrency: "₪",
        priceAmount: "20",
        priceNote: "دفعة واحدة · بدون رسوم متكررة",
        subscribeBtn: "اطلب الاشتراك عبر واتساب",
        subFeatures: [
          "إنشاء رموز QR غير محدودة",
          "معالجة ملفات PDF و CSV",
          "بطاقات مخصصة بتصاميم متعددة",
          "جميع التحديثات المستقبلية مجاناً",
          "دعم فني مباشر عبر واتساب",
          "بدون اشتراك شهري أو متكرر",
        ],
        orDivider: "أو",
      }
    : {
        title: "Sign In",
        subtitle: "Enter your credentials to access the software",
        emailLabel: "Email Address",
        emailPlaceholder: "example@email.com",
        passwordLabel: "Password",
        passwordPlaceholder: "••••••••",
        login: "Sign In",
        loggingIn: "Verifying...",
        invalidCreds: "Invalid email or password.",
        accountDisabled: "This account has been disabled. Contact support.",
        deviceMismatch: "This account is registered on another device. Contact support to reset the device.",
        networkError: "Network error. Check your connection and try again.",
        genericError: "Something went wrong. Please try again.",
        success: "Signed in successfully. Opening the app...",
        whatsappBtn: "Contact via WhatsApp",
        footerLine: "© A7D TEAM — All rights reserved",
        secured: "Encrypted & Secured · Firebase Auth",
        langBtn: "العربية",
        noAccount: "No account? Contact support",
        subBadge: "Exclusive Offer",
        subTitle: "Lifetime Subscription",
        subSubtitle: "One-time payment, use the full software forever",
        priceCurrency: "₪",
        priceAmount: "20",
        priceNote: "One-time · No recurring fees",
        subscribeBtn: "Subscribe via WhatsApp",
        subFeatures: [
          "Unlimited QR code generation",
          "PDF & CSV file processing",
          "Custom cards with multiple designs",
          "All future updates included free",
          "Direct WhatsApp support",
          "No monthly or recurring subscription",
        ],
        orDivider: "OR",
      }), [isAr]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [checking, setChecking] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  // Login attempts tracking functions
  const getLoginAttempts = useCallback(() => {
    const data = localStorage.getItem("loginAttempts");
    if (!data) return { count: 0, blockUntil: null };
    return JSON.parse(data);
  }, []);

  const setLoginAttempts = useCallback((count, blockUntil = null) => {
    localStorage.setItem("loginAttempts", JSON.stringify({ count, blockUntil }));
  }, []);

  const checkIfBlocked = useCallback(() => {
    const attempts = getLoginAttempts();
    if (attempts.blockUntil) {
      const now = Date.now();
      if (now < attempts.blockUntil) {
        setIsBlocked(true);
        setRemainingTime(Math.ceil((attempts.blockUntil - now) / 1000));
        return true;
      } else {
        // Block expired, reset attempts
        setLoginAttempts(0, null);
        setIsBlocked(false);
        return false;
      }
    }
    return false;
  }, [getLoginAttempts, setLoginAttempts]);

  useEffect(() => {
    checkIfBlocked();
    const interval = setInterval(() => {
      const attempts = getLoginAttempts();
      if (attempts.blockUntil) {
        const now = Date.now();
        if (now < attempts.blockUntil) {
          setRemainingTime(Math.ceil((attempts.blockUntil - now) / 1000));
        } else {
          setLoginAttempts(0, null);
          setIsBlocked(false);
          setRemainingTime(0);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [checkIfBlocked, getLoginAttempts, setLoginAttempts]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = ref(db, `users/${user.uid}`);
          const snap = await get(userRef);
          const data = snap.exists() ? (snap.val() || {}) : {};
          if (data.active === true) {
            const currentDeviceId = getOrCreateDeviceId();
            if (!data.deviceId) {
              // First-time registration on this device
              await update(userRef, {
                deviceId: currentDeviceId,
                deviceInfo: getDeviceInfo(),
                deviceRegisteredAt: Date.now(),
              });
              setStatus("success");
              setTimeout(() => onActivated && onActivated(user), 400);
              return;
            }
            if (data.deviceId === currentDeviceId) {
              setStatus("success");
              setTimeout(() => onActivated && onActivated(user), 400);
              return;
            }
            // Device mismatch -> sign out, show message
            await signOut(auth).catch(() => {});
            setStatus("error");
            setErrorMsg(t.deviceMismatch);
            setChecking(false);
            return;
          }
        } catch (_) {}
        await signOut(auth).catch(() => {});
      }
      setChecking(false);
    });
    return () => unsub();
  }, [onActivated, t.deviceMismatch]);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password) return;

    // Check if user is blocked
    const attempts = getLoginAttempts();
    if (attempts.blockUntil && Date.now() < attempts.blockUntil) {
      const timeLeft = Math.ceil((attempts.blockUntil - Date.now()) / 1000);
      setStatus("error");
      setErrorMsg(isAr 
        ? `تم حظر تسجيل الدخول مؤقتاً. حاول مرة أخرى بعد ${Math.floor(timeLeft / 60)} دقيقة و ${timeLeft % 60} ثانية`
        : `Login blocked temporarily. Try again in ${Math.floor(timeLeft / 60)} minutes and ${timeLeft % 60} seconds`
      );
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userRef = ref(db, `users/${cred.user.uid}`);
      const snap = await get(userRef);
      const data = snap.exists() ? (snap.val() || {}) : {};
      if (data.active !== true) {
        await signOut(auth);
        setStatus("error");
        setErrorMsg(t.accountDisabled);
        
        // Increment failed attempts
        const currentAttempts = getLoginAttempts();
        const newCount = currentAttempts.count + 1;
        if (newCount >= MAX_ATTEMPTS) {
          const blockUntil = Date.now() + BLOCK_DURATION;
          setLoginAttempts(0, blockUntil);
          setIsBlocked(true);
          setRemainingTime(BLOCK_DURATION / 1000);
          setErrorMsg(isAr 
            ? `تم استنفاد المحاولات المسموحة (${MAX_ATTEMPTS}). تم حظر تسجيل الدخول لمدة 15 دقيقة.`
            : `Maximum attempts (${MAX_ATTEMPTS}) exceeded. Login blocked for 15 minutes.`
          );
        } else {
          setLoginAttempts(newCount, null);
          const remaining = MAX_ATTEMPTS - newCount;
          setErrorMsg(isAr
            ? `${t.accountDisabled} - المحاولات المتبقية: ${remaining}/${MAX_ATTEMPTS}`
            : `${t.accountDisabled} - Remaining attempts: ${remaining}/${MAX_ATTEMPTS}`
          );
        }
        return;
      }

      // ---- Device lock check ----
      const currentDeviceId = getOrCreateDeviceId();
      if (!data.deviceId) {
        // First-time login -> bind this device to the account
        await update(userRef, {
          deviceId: currentDeviceId,
          deviceInfo: getDeviceInfo(),
          deviceRegisteredAt: Date.now(),
        });
      } else if (data.deviceId !== currentDeviceId) {
        await signOut(auth);
        setStatus("error");
        setErrorMsg(t.deviceMismatch);
        // Do NOT count this as a failed attempt (credentials were correct)
        return;
      }
      // ---------------------------

      // Success - reset attempts
      setLoginAttempts(0, null);
      setStatus("success");
      setTimeout(() => onActivated && onActivated(cred.user), 700);
    } catch (err) {
      const code = err.code || "";
      let errorMessage = "";
      
      if (["auth/invalid-credential","auth/wrong-password","auth/user-not-found","auth/invalid-email"].includes(code)) {
        errorMessage = t.invalidCreds;
      } else if (code === "auth/user-disabled") {
        errorMessage = t.accountDisabled;
      } else if (code === "auth/network-request-failed") {
        errorMessage = t.networkError;
      } else {
        errorMessage = t.genericError;
      }
      
      // Increment failed attempts for any authentication error
      const currentAttempts = getLoginAttempts();
      const newCount = currentAttempts.count + 1;
      
      if (newCount >= MAX_ATTEMPTS) {
        const blockUntil = Date.now() + BLOCK_DURATION;
        setLoginAttempts(0, blockUntil);
        setIsBlocked(true);
        setRemainingTime(BLOCK_DURATION / 1000);
        setErrorMsg(isAr 
          ? `تم استنفاد المحاولات المسموحة (${MAX_ATTEMPTS}). تم حظر تسجيل الدخول لمدة 15 دقيقة.`
          : `Maximum attempts (${MAX_ATTEMPTS}) exceeded. Login blocked for 15 minutes.`
        );
      } else {
        setLoginAttempts(newCount, null);
        const remaining = MAX_ATTEMPTS - newCount;
        setErrorMsg(isAr
          ? `${errorMessage} - المحاولات المتبقية: ${remaining}/${MAX_ATTEMPTS}`
          : `${errorMessage} - Remaining attempts: ${remaining}/${MAX_ATTEMPTS}`
        );
      }
      
      setStatus("error");
    }
  }, [email, password, onActivated, t, getLoginAttempts, setLoginAttempts, isAr]);

  const waLink = `https://wa.me/970566515104?text=${encodeURIComponent(
    isAr ? "السلام عليكم، أريد حساباً في برنامج A7D QR" : "Hello, I'd like an account for A7D QR"
  )}`;

  const subscribeLink = `https://wa.me/970566515104`;

  if (checking) {
    return (
      <div className="min-h-screen bg-[#06060c] flex items-center justify-center">
        <Icon.spinner width="32" height="32" className="text-violet-400" />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      data-testid="activation-gate"
      className="min-h-screen relative overflow-hidden bg-[#06060c] text-white flex items-center justify-center px-4 py-10"
      style={{ fontFamily: isAr ? "'Tajawal', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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

      <button onClick={onToggleLang} data-testid="gate-lang-toggle"
        className={`absolute top-5 ${isAr ? "left-5" : "right-5"} px-4 py-2 rounded-full text-xs font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition`}>
        {t.langBtn}
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6" data-testid="gate-brand">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 blur-md opacity-70" />
            <div className="relative h-12 w-12 rounded-xl bg-[#0d0d18] border border-white/10 flex items-center justify-center">
              <Icon.shield width="22" height="22" className="text-cyan-300" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] tracking-[0.3em] text-white/50 uppercase">A7D</span>
            <span className="text-base font-bold">Cards &amp; QR Generator</span>
          </div>
        </div>

        <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-7 sm:p-10 shadow-[0_30px_120px_-30px_rgba(139,92,246,0.35)]">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] tracking-[0.22em] uppercase text-white/60">
              <Icon.lock width="12" height="12" className="text-emerald-300" />
              {t.secured}
            </span>
            <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300">
                {t.title}
              </span>
            </h1>
            <p className="mt-3 text-sm text-white/55">{t.subtitle}</p>
          </div>

          <div className="mb-5">
            <label className="block text-xs uppercase tracking-[0.2em] text-white/45 mb-2">{t.emailLabel}</label>
            <div className="relative">
              <Icon.user width="16" height="16"
                className={`absolute top-1/2 -translate-y-1/2 text-white/30 ${isAr ? "right-4" : "left-4"}`} />
              <input
                type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                placeholder={t.emailPlaceholder}
                autoComplete="email" spellCheck="false"
                className={`w-full bg-[#0d0d18] border rounded-2xl py-4 outline-none transition text-sm placeholder:text-white/20
                  ${isAr ? "pr-11 pl-5 text-right" : "pl-11 pr-5 text-left"}
                  ${status === "error" ? "border-rose-400/50 focus:border-rose-400" : "border-white/10 focus:border-violet-400/60"}`}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs uppercase tracking-[0.2em] text-white/45 mb-2">{t.passwordLabel}</label>
            <div className="relative">
              <Icon.lock width="16" height="16"
                className={`absolute top-1/2 -translate-y-1/2 text-white/30 ${isAr ? "right-4" : "left-4"}`} />
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={(e) => { setPassword(e.target.value); if (status === "error") setStatus("idle"); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                placeholder={t.passwordPlaceholder}
                autoComplete="current-password"
                className={`w-full bg-[#0d0d18] border rounded-2xl py-4 outline-none transition text-sm placeholder:text-white/20
                  ${isAr ? "pr-11 pl-12 text-right" : "pl-11 pr-12 text-left"}
                  ${status === "error" ? "border-rose-400/50 focus:border-rose-400" : "border-white/10 focus:border-violet-400/60"}`}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/40 hover:text-white/70 transition ${isAr ? "left-3" : "right-3"}`}>
                {showPw ? <Icon.eyeOff width="16" height="16" /> : <Icon.eye width="16" height="16" />}
              </button>
            </div>
          </div>

          {status === "error" && (
            <p className="mb-5 text-sm text-rose-300 flex items-center gap-2" data-testid="gate-error-msg">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
              {errorMsg}
            </p>
          )}
          {status === "success" && (
            <p className="mb-5 text-sm text-emerald-300 flex items-center gap-2" data-testid="gate-success-msg">
              <Icon.check width="16" height="16" />
              {t.success}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={handleLogin}
              disabled={!email.trim() || !password || status === "loading" || status === "success" || isBlocked}
              data-testid="gate-login-btn"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-[#0d0d18] bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_10px_40px_-10px_rgba(139,92,246,0.6)]"
              type="button">
              {status === "loading"
                ? <><Icon.spinner width="18" height="18" className="text-[#0d0d18]" />{t.loggingIn}</>
                : isBlocked
                ? <><Icon.lock width="18" height="18" />{isAr ? "محظور مؤقتاً" : "Temporarily Blocked"}</>
                : <><Icon.shield width="18" height="18" />{t.login}</>}
            </button>
            {isBlocked && (
              <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-400/30 text-center" data-testid="block-timer">
                <p className="text-sm text-rose-300 font-semibold">
                  {isAr ? "⏱️ الوقت المتبقي: " : "⏱️ Time remaining: "}
                  <span className="font-mono">{Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}</span>
                </p>
              </div>
            )}
            <a href={waLink} target="_blank" rel="noreferrer" data-testid="gate-whatsapp-btn"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition">
              <Icon.whatsapp width="18" height="18" />
              {t.whatsappBtn}
              <span dir="ltr" className="text-xs opacity-70 font-mono">+970 566 515 104</span>
            </a>
          </div>
          <p className="mt-6 text-center text-xs text-white/35">{t.noAccount}</p>
        </div>

        {/* Subscription Offer Card */}
        <div
          data-testid="subscription-offer-card"
          className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-7 sm:p-9 mt-6 shadow-[0_30px_120px_-30px_rgba(16,185,129,0.35)] overflow-hidden"
        >
          {/* decorative glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-center mb-4">
              <span
                data-testid="sub-badge"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-[10px] tracking-[0.22em] uppercase text-emerald-200"
              >
                <Icon.sparkle width="12" height="12" />
                {t.subBadge}
              </span>
            </div>

            <h2
              data-testid="sub-title"
              className="text-center text-2xl sm:text-3xl font-bold tracking-tight"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300">
                {t.subTitle}
              </span>
            </h2>
            <p className="mt-2 text-center text-sm text-white/55">{t.subSubtitle}</p>

            {/* Price */}
            <div className="mt-6 flex items-end justify-center gap-1.5" data-testid="sub-price">
              <span className="text-base font-semibold text-emerald-300/80 mb-2">
                {t.priceCurrency}
              </span>
              <span className="text-6xl sm:text-7xl font-black leading-none bg-clip-text text-transparent bg-gradient-to-b from-white to-emerald-200">
                {t.priceAmount}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300/90 mb-3 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30">
                <Icon.infinity width="14" height="14" />
                {isAr ? "مدى الحياة" : "Lifetime"}
              </span>
            </div>
            <p className="mt-2 text-center text-[11px] uppercase tracking-[0.2em] text-white/45">
              {t.priceNote}
            </p>

            {/* Features */}
            <ul
              data-testid="sub-features-list"
              className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3"
            >
              {t.subFeatures.map((feat, i) => (
                <li
                  key={i}
                  data-testid={`sub-feature-${i}`}
                  className="flex items-start gap-2.5 text-sm text-white/75"
                >
                  <span className="mt-0.5 flex-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                    <Icon.check width="12" height="12" />
                  </span>
                  <span className="leading-relaxed">{feat}</span>
                </li>
              ))}
            </ul>

            {/* Subscribe button */}
            <a
              href={subscribeLink}
              target="_blank"
              rel="noreferrer"
              data-testid="sub-whatsapp-btn"
              className="mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-[#06281c] bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 hover:opacity-90 transition shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)]"
            >
              <Icon.whatsapp width="18" height="18" />
              {t.subscribeBtn}
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/35" data-testid="gate-footer">{t.footerLine}</p>
      </div>
    </div>
  );
}
