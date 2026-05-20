# QR Generator - PRD

## المشروع
تطبيق ويب لتوليد رموز QR وبطاقات الاشتراك، مع نظام تسجيل دخول عبر Firebase.

## Architecture
- **Frontend**: React 19 + TailwindCSS + CRAco
- **Backend**: FastAPI + MongoDB (Motor)
- **Auth**: Firebase Auth (ActivationGate)
- **QR Library**: qrcode@1.5.4
- **PDF**: pdf-lib + pdfjs-dist@3.11.174

## Core Features

### 1. مولد QR (QR Generator)
- رفع ملف PDF للبيانات + ملف PDF للتصميم
- استخراج بيانات username/password من PDF
- توليد رموز QR مع الأنماط المخصصة
- تصدير PDF مدمج

### 2. مستخرج البطاقات (Card Extractor)
- رفع ملفات Excel/CSV/PDF
- رفع قالب صورة (JPG/PNG)
- تكوين مواضع النصوص والألوان والشبكة
- قوالب محفوظة في localStorage
- توليد PDF بطاقات مع QR مخصص

### 3. تخصيص QR (QR Customizer) - **جديد**
- لون النقاط، لون الخلفية
- صورة خلفية مخصصة
- ألوان إطارات الزوايا (outer/inner)
- شكل النقاط: square | rounded | dots | classy
- شكل الزوايا: square | rounded | extra-rounded | dot
- شعار (لوجو) في المنتصف + تحكم بالحجم والتقريب والخلفية
- معاينة مباشرة (Live Preview)
- حفظ في MongoDB عبر API

## تفاصيل تقنية

### Backend Endpoints
- `GET /api/` - health check
- `GET /api/qr-style` - جلب إعدادات QR
- `PUT /api/qr-style` - حفظ إعدادات QR

### Frontend Structure
```
src/
  App.js                    # Sidebar layout + routing
  lib/
    i18n.js                 # AR/EN translations
    qrStyler.js             # QR style engine (canvas)
    pdfProcessor.js         # QR Generator processor
    cardProcessor.js        # Card PDF generator
    dataParser.js           # Excel/CSV/PDF parser
  context/
    QrStyleContext.jsx      # Global QR style state
  components/
    QrCustomizer.jsx        # QR customization UI (new)
    QrGenerator.jsx         # QR from PDF
    CardUploadPhase.jsx     # Upload step
    CardConfigurePhase.jsx  # Configure step
    CardGeneratePhase.jsx   # Generate step
    CardPreview.jsx         # Canvas preview
    ActivationGate.jsx      # Firebase login
```

## ما تم تنفيذه (Feb 2026)
- [x] نقل كامل مشروع ZIP إلى البيئة
- [x] تثبيت جميع الحزم (firebase, pdf-lib, pdfjs-dist, qrcode, xlsx, papaparse...)
- [x] إنشاء lib files (i18n, qrStyler, pdfProcessor, cardProcessor, dataParser)
- [x] إنشاء QrStyleContext للحالة العامة
- [x] إنشاء QrCustomizer component
- [x] تحديث App.js لـ Sidebar layout
- [x] ربط QR style مع QrGenerator و CardGeneratePhase
- [x] Backend API لحفظ/جلب QR style من MongoDB
- [x] اختبار Backend 100% نجاح

## Backlog
- [ ] اختبار تسجيل الدخول (يحتاج Firebase credentials)
- [ ] تحديث CardPreview لعرض QR بالأنماط المخصصة
- [ ] إضافة قوالب جاهزة (presets) للأنماط الشائعة
- [ ] دعم تصدير QR كصورة منفردة
- [ ] إضافة نص/وصف تحت QR
