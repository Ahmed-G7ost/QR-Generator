import { useMemo } from "react";

/* ---------- Icons ---------- */
const Icon = {
  sparkle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7L19 17z" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  heart: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  x: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
};

export default function SupportDialog({ open, onClose, lang = "ar" }) {
  const isAr = lang === "ar";

  const t = useMemo(() => (isAr
    ? {
        title: "الدعم المادي",
        subtitle: "ساهم في تطوير وتحسين البرنامج",
        supportNote: "يمكنك الدعم عبر",
        supportMethods: ["جوال باي", "مالشات"],
        supportNumber: "0598357971",
        walletNumber: "رقم المحفظة",
        features: [
          "دعمك يساعدنا في تطوير ميزات جديدة",
          "تحسين الأداء والاستقرار",
          "إضافة المزيد من التصاميم",
          "توفير دعم فني أفضل",
          "تحديثات مستمرة ومجانية",
          "مجتمع داعم ومتطور",
        ],
        thankYou: "شكراً لدعمك! مساهمتك تساعدنا في الاستمرار وتقديم خدمة أفضل للجميع",
      }
    : {
        title: "Financial Support",
        subtitle: "Help us develop and improve the software",
        supportNote: "You can support via",
        supportMethods: ["Jawwal Pay", "Malshat"],
        supportNumber: "0598357971",
        walletNumber: "Wallet Number",
        features: [
          "Your support helps us develop new features",
          "Improve performance and stability",
          "Add more design templates",
          "Provide better technical support",
          "Continuous free updates",
          "Growing supportive community",
        ],
        thankYou: "Thank you for your support! Your contribution helps us continue and provide better service for everyone",
      }), [isAr]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        data-testid="support-dialog-backdrop"
      />
      
      {/* Dialog */}
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4"
        data-testid="support-dialog"
      >
        <div className="relative rounded-3xl border border-white/10 bg-[#0d0d1a]/95 backdrop-blur-xl p-7 sm:p-9 shadow-[0_30px_120px_-30px_rgba(16,185,129,0.35)] overflow-hidden">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition"
            aria-label="Close"
            data-testid="support-dialog-close"
          >
            <Icon.x width="18" height="18" />
          </button>

          <div className="relative">
            {/* Badge */}
            <div className="flex items-center justify-center mb-4">
              <span
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-[10px] tracking-[0.22em] uppercase text-emerald-200"
              >
                <Icon.sparkle width="12" height="12" />
                {isAr ? "ادعمنا" : "Support Us"}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300">
                {t.title}
              </span>
            </h2>
            <p className="mt-2 text-center text-sm text-white/55">{t.subtitle}</p>

            {/* Support Section */}
            <div className="mt-6 flex flex-col items-center gap-4">
              <p className="text-center text-sm text-white/60">{t.supportNote}</p>
              
              {/* Payment Methods Logos */}
              <div className="flex items-center justify-center gap-4 mb-2">
                <div className="relative group">
                  <img 
                    src="/images/jawwal-pay.jpg" 
                    alt="Jawwal Pay" 
                    className="h-16 w-16 rounded-xl object-cover border-2 border-white/10 group-hover:border-emerald-400/50 transition-all shadow-lg"
                  />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/50 whitespace-nowrap">
                    {t.supportMethods[0]}
                  </span>
                </div>
                <span className="text-2xl text-white/40">•</span>
                <div className="relative group">
                  <img 
                    src="/images/malshat.jpg" 
                    alt="Malshat" 
                    className="h-16 w-16 rounded-xl object-cover border-2 border-white/10 group-hover:border-emerald-400/50 transition-all shadow-lg"
                  />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/50 whitespace-nowrap">
                    {t.supportMethods[1]}
                  </span>
                </div>
              </div>

              {/* Phone Number */}
              <div className="mt-4 px-6 py-4 rounded-2xl bg-white/[0.05] border border-emerald-400/30 backdrop-blur-sm">
                <p className="text-center text-xs text-emerald-300/70 mb-1.5 uppercase tracking-wider">
                  {t.walletNumber}
                </p>
                <p 
                  dir="ltr" 
                  className="text-center text-3xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-b from-white to-emerald-200"
                >
                  {t.supportNumber}
                </p>
              </div>
            </div>

            {/* Features */}
            <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {t.features.map((feat, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-white/75"
                >
                  <span className="mt-0.5 flex-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                    <Icon.check width="12" height="12" />
                  </span>
                  <span className="leading-relaxed">{feat}</span>
                </li>
              ))}
            </ul>

            {/* Thank you note */}
            <div className="mt-6 text-center">
              <p className="text-xs text-white/40 leading-relaxed flex items-center justify-center gap-2">
                <Icon.heart width="14" height="14" className="text-emerald-400/60" />
                {t.thankYou}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
