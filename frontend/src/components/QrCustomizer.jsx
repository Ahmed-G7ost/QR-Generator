import { useState, useEffect, useRef, useCallback } from "react";
import { useQrStyle } from "@/context/QrStyleContext";
import { generateStyledQR, DOT_STYLES, CORNER_STYLES, DEFAULT_QR_STYLE } from "@/lib/qrStyler";

// ── Color Picker ──────────────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange, testId }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-white/60 flex-1">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-testid={testId}
            className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer"
          />
          <div
            className="w-8 h-8 rounded-lg border-2 border-white/20 cursor-pointer shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: value }}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v.length === 7 ? v : value);
          }}
          className="w-20 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-400/50"
        />
      </div>
    </div>
  );
}

// ── Image Uploader ────────────────────────────────────────────────────────────

function ImageUploader({ label, value, onChange, testId, hint }) {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-white/60">{label}</label>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-white/15 bg-white/[0.02] group">
          <img src={value} alt={label} className="w-full h-24 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              data-testid={`${testId}-change`}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition"
            >
              تغيير
            </button>
            <button
              onClick={() => onChange(null)}
              data-testid={`${testId}-remove`}
              className="px-3 py-1.5 rounded-lg bg-rose-500/40 text-rose-200 text-xs font-semibold hover:bg-rose-500/60 transition"
            >
              إزالة
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          data-testid={`${testId}-upload`}
          className="w-full h-16 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/30 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/40">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-white/40">{hint || "اضغط للرفع"}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        data-testid={`${testId}-input`}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

// ── Style Selector Buttons ─────────────────────────────────────────────────────

function StyleSelector({ label, options, value, onChange, lang, testIdPrefix }) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-white/60">{label}</label>
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            data-testid={`${testIdPrefix}-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border py-2 px-1 text-center text-[10px] font-semibold transition-all ${
              value === opt.value
                ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70"
            }`}
          >
            {lang === "ar" ? opt.labelAr : opt.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

function SliderRow({ label, value, onChange, min, max, step = 0.01, displayValue, testId }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/60">{label}</label>
        <span className="text-xs font-mono text-white/50">{displayValue ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId}
        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400"
      />
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <h3 className="text-[11px] uppercase tracking-[0.25em] text-white/50 font-bold">{title}</h3>
      {children}
    </div>
  );
}

// ── Main QR Customizer ────────────────────────────────────────────────────────

export default function QrCustomizer({ t, lang }) {
  const { qrStyle, saveQrStyle, loading } = useQrStyle();
  const [local, setLocal] = useState({ ...DEFAULT_QR_STYLE, ...qrStyle });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const previewTimerRef = useRef(null);

  // Sync with context when it loads
  useEffect(() => {
    setLocal({ ...DEFAULT_QR_STYLE, ...qrStyle });
  }, [qrStyle]);

  // Live preview with debounce
  const refreshPreview = useCallback(async (style) => {
    try {
      const url = await generateStyledQR("A7D QR GENERATOR", style, 260);
      setPreviewUrl(url);
    } catch {}
  }, []);

  useEffect(() => {
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => refreshPreview(local), 300);
    return () => clearTimeout(previewTimerRef.current);
  }, [local, refreshPreview]);

  const update = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    const ok = await saveQrStyle(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_QR_STYLE });
    setSaved(false);
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="qr-customizer">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">{t.qrCustomizer}</h2>
        <p className="text-sm text-white/50 mt-1">{t.qrCustomizerDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
          {/* Dot Style */}
          <Section title={t.qrDotStyle}>
            <StyleSelector
              label={t.qrDotStyle}
              options={DOT_STYLES}
              value={local.dotStyle}
              onChange={(v) => update("dotStyle", v)}
              lang={lang}
              testIdPrefix="dot-style"
            />
            <StyleSelector
              label={t.qrCornerStyle}
              options={CORNER_STYLES}
              value={local.cornerStyle}
              onChange={(v) => update("cornerStyle", v)}
              lang={lang}
              testIdPrefix="corner-style"
            />
          </Section>

          {/* Colors */}
          <Section title={t.qrColorsSection}>
            <ColorPicker
              label={t.qrDotColor}
              value={local.dotColor}
              onChange={(v) => update("dotColor", v)}
              testId="qr-dot-color"
            />
            <ColorPicker
              label={t.qrBgColor}
              value={local.backgroundColor}
              onChange={(v) => update("backgroundColor", v)}
              testId="qr-bg-color"
            />
            <ColorPicker
              label={t.qrEyeOuterColor}
              value={local.eyeOuterColor}
              onChange={(v) => update("eyeOuterColor", v)}
              testId="qr-eye-outer-color"
            />
            <ColorPicker
              label={t.qrEyeInnerColor}
              value={local.eyeInnerColor}
              onChange={(v) => update("eyeInnerColor", v)}
              testId="qr-eye-inner-color"
            />
          </Section>

          {/* Background Image */}
          <Section title={t.qrBgImage}>
            <ImageUploader
              label={t.qrUploadBgImage}
              value={local.backgroundImage}
              onChange={(v) => update("backgroundImage", v)}
              testId="qr-bg-image"
              hint={t.qrUploadBgImage}
            />
          </Section>

          {/* Logo */}
          <Section title={t.qrLogoSection}>
            <ImageUploader
              label={t.qrLogoImage}
              value={local.logoImage}
              onChange={(v) => update("logoImage", v)}
              testId="qr-logo-image"
              hint={t.qrUploadLogo}
            />
            {local.logoImage && (
              <div className="space-y-3 pt-2">
                <SliderRow
                  label={t.qrLogoSize}
                  value={local.logoSizeRatio}
                  min={0.1}
                  max={0.4}
                  step={0.01}
                  displayValue={`${Math.round(local.logoSizeRatio * 100)}%`}
                  onChange={(v) => update("logoSizeRatio", v)}
                  testId="qr-logo-size"
                />
                <SliderRow
                  label={t.qrLogoBorderRadius}
                  value={local.logoBorderRadius}
                  min={0}
                  max={50}
                  step={1}
                  displayValue={`${local.logoBorderRadius}px`}
                  onChange={(v) => update("logoBorderRadius", v)}
                  testId="qr-logo-radius"
                />
                <ColorPicker
                  label={t.qrLogoBg}
                  value={local.logoBackgroundColor}
                  onChange={(v) => update("logoBackgroundColor", v)}
                  testId="qr-logo-bg-color"
                />
              </div>
            )}
          </Section>
        </div>

        {/* Right: Preview */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-[11px] uppercase tracking-[0.25em] text-white/50 font-bold mb-4">
              {t.qrPreviewSection}
            </h3>
            <div
              className="flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6"
              style={{
                backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%)",
                backgroundSize: "16px 16px",
              }}
              data-testid="qr-preview-container"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="QR Preview"
                  data-testid="qr-preview-image"
                  className="rounded-xl shadow-2xl"
                  style={{ width: 220, height: 220, imageRendering: "pixelated" }}
                />
              ) : (
                <div className="w-56 h-56 rounded-xl bg-white/5 flex items-center justify-center">
                  <svg className="animate-spin w-8 h-8 text-white/30" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-center text-[10px] text-white/30 mt-2">{t.qrSampleText}: A7D QR GENERATOR</p>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSave}
              disabled={loading}
              data-testid="qr-save-style-btn"
              className="group relative w-full h-12 rounded-2xl font-bold tracking-wide overflow-hidden transition-all disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
              <span className="relative flex items-center justify-center gap-2 text-white text-sm">
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    {t.qrSaving}
                  </>
                ) : saved ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12l5 5L20 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t.qrStyleSaved}
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 21 17 13 7 13 7 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="7 3 7 8 15 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t.qrSaveStyle}
                  </>
                )}
              </span>
            </button>

            <button
              onClick={handleReset}
              data-testid="qr-reset-style-btn"
              className="w-full h-10 rounded-xl font-semibold text-xs text-white/50 border border-white/10 hover:bg-white/[0.04] hover:text-white/70 transition"
            >
              {t.qrResetStyle}
            </button>
          </div>

          {/* Quick info */}
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold">الإعدادات الحالية</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: lang === "ar" ? "نمط النقاط" : "Dot Style", value: local.dotStyle },
                { label: lang === "ar" ? "نمط الزوايا" : "Corner Style", value: local.cornerStyle },
                { label: lang === "ar" ? "لون النقاط" : "Dot Color", value: local.dotColor },
                { label: lang === "ar" ? "الخلفية" : "Background", value: local.backgroundColor },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40">{item.label}:</span>
                  <span className="text-[10px] font-mono text-white/60 flex items-center gap-1">
                    {item.value.startsWith("#") && (
                      <span className="inline-block w-2.5 h-2.5 rounded-sm border border-white/20" style={{ backgroundColor: item.value }} />
                    )}
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
