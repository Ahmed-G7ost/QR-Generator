import { useState, useEffect, useCallback, useRef } from "react";
import CardPreview from "./CardPreview";
import QrStyleCustomizer from "./QrStyleCustomizer";

const TEMPLATES_KEY = "qr_card_saved_templates_v1";

function loadSavedTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedTemplates(list) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch { /* quota / private mode */ }
}

const GRID_OPTIONS = [
  { value: "3x8", label: "3 x 8", desc: "24" },
  { value: "4x8", label: "4 x 8", desc: "32" },
  { value: "4x10", label: "4 x 10", desc: "40" },
  { value: "5x10", label: "5 x 10", desc: "50" },
];

const QR_CONTENT_OPTIONS = [
  { value: "username", labelKey: "username" },
  { value: "password", labelKey: "password" },
  { value: "both", labelKey: "qrBoth" },
  { value: "link", labelKey: "qrLink" },
];

function SliderRow({ label, value, onChange, min, max, testId }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-14 text-end shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId} className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer" />
      <span className="text-xs font-mono text-white/60 w-8">{value}</span>
    </div>
  );
}

function ColorPicker({ value, onChange, testId }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        data-testid={testId} className="h-6 w-6 border border-white/20 rounded cursor-pointer bg-transparent p-0" />
      <span className="font-mono text-[10px] text-white/40">{value}</span>
    </div>
  );
}

function TextBlock({ title, config, prefix, onChange, t, colorKey }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-white/60 font-bold">{title}</span>
        <ColorPicker value={config[colorKey]} onChange={(v) => onChange(colorKey, v)} testId={`${prefix}-color`} />
      </div>
      <SliderRow label={t.fontSize} value={config[`${prefix}_font_size`]} onChange={(v) => onChange(`${prefix}_font_size`, v)} min={6} max={72} testId={`${prefix}-font-slider`} />
      <SliderRow label={t.positionX} value={config[`${prefix}_x`]} onChange={(v) => onChange(`${prefix}_x`, v)} min={0} max={100} testId={`${prefix}-x-slider`} />
      <SliderRow label={t.positionY} value={config[`${prefix}_y`]} onChange={(v) => onChange(`${prefix}_y`, v)} min={0} max={100} testId={`${prefix}-y-slider`} />
    </div>
  );
}

function ToggleBtn({ checked, onChange, testId }) {
  return (
    <button data-testid={testId} onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-all relative ${checked ? "bg-cyan-400" : "bg-white/20"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

export default function CardConfigurePhase({ t, lang, state, dispatch, onNext, onBack }) {
  const { config, records, templateUrl, sessionId } = state;
  const sampleRecord = records[0] || { username: "123456789012", password: "123456" };
  const updateConfig = (key, value) => dispatch({ type: "UPDATE_CONFIG", payload: { [key]: value } });
  const fontInputRef = useRef(null);

  // Saved templates
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isCustomGrid, setIsCustomGrid] = useState(false);
  const [customCols, setCustomCols] = useState(5);
  const [customRows, setCustomRows] = useState(11);

  useEffect(() => { setTemplates(loadSavedTemplates()); }, []);

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    // Exclude non-serializable custom_font & qr_logo & qr_fg_image (File objects) before saving.
    const { custom_font: _omit, qr_logo: _omitLogo, qr_fg_image: _omitFgImg, ...serializable } = config;
    const id = String(Date.now());
    const next = [...templates, { id, name: templateName.trim(), config: serializable }];
    setTemplates(next);
    persistSavedTemplates(next);
    setTemplateName(""); setShowSaveInput(false);
  };

  const loadTemplate = (tpl) => dispatch({ type: "UPDATE_CONFIG", payload: tpl.config });

  const deleteTemplate = (id) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    persistSavedTemplates(next);
  };

  // Font upload — store the File itself in state for later embedding via fontkit.
  const handleFontUpload = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["ttf", "otf", "woff"].includes(ext)) return;
    // Store the File object directly; cardProcessor reads bytes when generating.
    updateConfig("custom_font", file);
  };

  // Handle drag position from preview
  const handlePositionChange = useCallback((key, value) => {
    updateConfig(key, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-3 space-y-4">

          {/* Saved Templates */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">{t.savedTemplates}</span>
              <button data-testid="save-template-toggle" onClick={() => setShowSaveInput(!showSaveInput)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-all">
                + {t.saveTemplate}
              </button>
            </div>
            {showSaveInput && (
              <div className="flex gap-2 mb-3">
                <input data-testid="template-name-input" value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)} placeholder={t.templateNamePlaceholder}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-white/30"
                  onKeyDown={(e) => e.key === "Enter" && saveTemplate()} />
                <button data-testid="save-template-btn" onClick={saveTemplate}
                  className="px-4 py-2 rounded-lg bg-cyan-400/20 text-cyan-300 text-xs font-bold hover:bg-cyan-400/30 transition-all">
                  {t.save}
                </button>
              </div>
            )}
            {templates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-1 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5 group">
                    <button data-testid={`load-template-${tpl.id}`} onClick={() => loadTemplate(tpl)}
                      className="text-xs text-white/70 hover:text-white font-medium transition-all">{tpl.name}</button>
                    <button data-testid={`delete-template-${tpl.id}`} onClick={() => deleteTemplate(tpl.id)}
                      className="text-white/20 hover:text-rose-400 text-xs ms-1 opacity-0 group-hover:opacity-100 transition-all">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grid Layout */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold block mb-3">{t.gridLayout}</span>
            <div className="grid grid-cols-4 gap-2" data-testid="grid-layout-options">
              {GRID_OPTIONS.map((opt) => (
                <button key={opt.value} data-testid={`grid-option-${opt.value}`}
                  onClick={() => { setIsCustomGrid(false); updateConfig("grid", opt.value); }}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    !isCustomGrid && config.grid === opt.value
                      ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"}`}>
                  <span className="font-mono font-bold text-sm block">{opt.label}</span>
                  <span className="text-[10px] text-white/40">{opt.desc} cards</span>
                </button>
              ))}
              {/* Custom option */}
              <button
                data-testid="grid-option-custom"
                onClick={() => { setIsCustomGrid(true); updateConfig("grid", `${customCols}x${customRows}`); }}
                className={`rounded-xl border p-3 text-center transition-all ${
                  isCustomGrid
                    ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"}`}>
                <span className="font-mono font-bold text-sm block">{t.customGrid}</span>
                <span className="text-[10px] text-white/40">{isCustomGrid ? `${customCols * customRows} ${t.customGridCardsPerPage}` : "..."}</span>
              </button>
            </div>
            {/* Custom grid inputs — shown only when custom is selected */}
            {isCustomGrid && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-semibold">{t.customGridCols}</label>
                  <input
                    type="number" min={1} max={20} value={customCols}
                    data-testid="custom-grid-cols"
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                      setCustomCols(v);
                      updateConfig("grid", `${v}x${customRows}`);
                    }}
                    className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-400/50 text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-semibold">{t.customGridRows}</label>
                  <input
                    type="number" min={1} max={20} value={customRows}
                    data-testid="custom-grid-rows"
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                      setCustomRows(v);
                      updateConfig("grid", `${customCols}x${v}`);
                    }}
                    className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-400/50 text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-semibold">{t.customGridCardsPerPage}</label>
                  <input
                    type="number" min={1} max={400} value={customCols * customRows}
                    data-testid="custom-grid-total"
                    onChange={(e) => {
                      const total = Math.max(1, Math.min(400, parseInt(e.target.value) || 1));
                      const newCols = Math.max(1, Math.round(Math.sqrt(total)));
                      const newRows = Math.max(1, Math.ceil(total / newCols));
                      setCustomCols(newCols);
                      setCustomRows(newRows);
                      updateConfig("grid", `${newCols}x${newRows}`);
                    }}
                    className="bg-white/[0.04] border border-cyan-400/20 rounded-xl px-3 py-2 text-cyan-300 text-sm font-mono focus:outline-none focus:border-cyan-400/50 text-center font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Custom Font */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">{t.customFont}</span>
              <button data-testid="upload-font-btn" onClick={() => fontInputRef.current?.click()}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-all">
                {config.custom_font ? `✓ ${config.custom_font.name || config.custom_font}` : t.uploadFont}
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-1">{t.fontHint}</p>
            <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff" className="hidden"
              data-testid="font-file-input"
              onChange={(e) => handleFontUpload(e.target.files?.[0])} />
          </div>

          {/* QR Code Section */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">{t.qrCode}</span>
              <ToggleBtn checked={config.show_qr} onChange={(v) => updateConfig("show_qr", v)} testId="card-qr-toggle" />
            </div>
            {config.show_qr && (
              <div className="space-y-3">
                {/* QR Content */}
                <div className="grid grid-cols-2 gap-2">
                  {QR_CONTENT_OPTIONS.map((opt) => (
                    <button key={opt.value} data-testid={`qr-content-${opt.value}`}
                      onClick={() => updateConfig("qr_content", opt.value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        config.qr_content === opt.value
                          ? "border-cyan-400/60 bg-cyan-400/10 text-white"
                          : "border-white/10 text-white/50 hover:border-white/20"}`}>
                      {t[opt.labelKey]}
                    </button>
                  ))}
                </div>
                
                {/* Server Address for Link option */}
                {config.qr_content === "link" && (
                  <div className="space-y-2">
                    <label className="text-xs text-white/50">{t.qrServerAddress}</label>
                    <input
                      type="text"
                      value={config.server_address || ""}
                      onChange={(e) => updateConfig("server_address", e.target.value)}
                      placeholder={t.qrServerPlaceholder}
                      data-testid="qr-server-input"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-white/30"
                    />
                    <p className="text-[10px] text-white/30">
                      {lang === "ar" 
                        ? "سيتم إنشاء رابط: http://[السيرفر]/login?username=[اليوزر]&password=[الباسورد]"
                        : "Will generate: http://[server]/login?username=[user]&password=[pass]"
                      }
                    </p>
                  </div>
                )}
                
                <SliderRow label={t.qrSizeLabel} value={config.qr_size} onChange={(v) => updateConfig("qr_size", v)} min={5} max={60} testId="qr-size-slider" />
                <SliderRow label={t.positionX} value={config.qr_x} onChange={(v) => updateConfig("qr_x", v)} min={0} max={100} testId="qr-x-slider" />
                <SliderRow label={t.positionY} value={config.qr_y} onChange={(v) => updateConfig("qr_y", v)} min={0} max={100} testId="qr-y-slider" />
              </div>
            )}
          </div>

          {/* QR Style Customizer - shown when QR is enabled */}
          {config.show_qr && (
            <QrStyleCustomizer config={config} updateConfig={updateConfig} t={t} />
          )}

          {/* Date + Counter */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">{t.dateToggle}</span>
              <ToggleBtn checked={config.show_date} onChange={(v) => updateConfig("show_date", v)} testId="card-date-toggle" />
            </div>
            {config.show_date && (
              <div className="space-y-3">
                <input type="date" data-testid="card-date-input" value={config.date_text}
                  onChange={(e) => updateConfig("date_text", e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50" />
                <div className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                  <span className="text-xs text-white/50">{t.counterToggle}</span>
                  <ToggleBtn checked={config.show_counter} onChange={(v) => updateConfig("show_counter", v)} testId="card-counter-toggle" />
                </div>
                {config.show_counter && config.date_text && (
                  <div className="text-xs text-white/40 font-mono bg-white/[0.03] rounded-lg px-3 py-2">
                    {t.counterExample}: {config.date_text}/{1}, {config.date_text}/{2}, ...
                  </div>
                )}
                <TextBlock title={t.dateSettings} config={config} prefix="date" onChange={updateConfig} t={t} colorKey="date_color" />
              </div>
            )}
          </div>

          {/* Label */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold block mb-3">{t.labelText}</span>
            <input type="text" data-testid="card-label-input" value={config.label_text}
              onChange={(e) => updateConfig("label_text", e.target.value)} placeholder={t.labelPlaceholder}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-white/30" />
            {config.label_text && (
              <div className="mt-3">
                <TextBlock title={t.labelSettings} config={config} prefix="label" onChange={updateConfig} t={t} colorKey="label_color" />
              </div>
            )}
          </div>

          {/* Username & Password */}
          <TextBlock title={t.usernameSettings} config={config} prefix="username" onChange={updateConfig} t={t} colorKey="username_color" />
          <TextBlock title={t.passwordSettings} config={config} prefix="password" onChange={updateConfig} t={t} colorKey="password_color" />
        </div>

        {/* Right: Interactive Preview */}
        <div className="lg:col-span-2 relative">
          <div className="sticky top-6 space-y-3">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">{t.preview}</span>
            <CardPreview
              templateUrl={templateUrl}
              sampleRecord={sampleRecord}
              config={config}
              onPositionChange={handlePositionChange}
              t={t}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-white/10">
        <button data-testid="card-back-to-upload-btn" onClick={onBack}
          className="px-6 py-3 rounded-xl font-semibold text-white/70 border border-white/15 hover:bg-white/[0.04] transition-all">
          ← {t.backBtn}
        </button>
        <button data-testid="card-next-to-generate-btn" onClick={onNext}
          className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-400 hover:opacity-90 transition-all">
          {t.nextBtn} →
        </button>
      </div>
    </div>
  );
}
