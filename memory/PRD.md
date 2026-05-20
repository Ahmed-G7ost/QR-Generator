# A7D Cards & QR Generator - PRD

## Problem Statement
Frontend-only React + Firebase (Auth + Realtime Database) project.
User asks: lock each client account to **one device only**. If a user logs in successfully on a device, the same credentials must NOT work on any other device until the admin resets the device binding.

## Architecture
- Frontend: React (CRA + craco), Firebase Auth + Realtime Database
- Admin panel: standalone static HTML served at `/admin.html`
- No custom backend (no FastAPI/Mongo) — pure client + Firebase

## Implemented (2026-01)
### One-Device-per-Account (new)
- **Client (`ActivationGate.jsx`)**:
  - Generates a stable per-browser `deviceId` stored in `localStorage["a7d_device_id"]` (random `dev_...`)
  - On every successful Firebase Auth sign-in (manual + auto-restore via `onAuthStateChanged`):
    1. Reads `users/{uid}` from Realtime DB
    2. If `active !== true` → reject (existing behaviour, kept)
    3. If `deviceId` is empty/missing → writes the current device's `deviceId`, `deviceInfo` (UA, platform, language) and `deviceRegisteredAt` (first-time binding)
    4. If `deviceId` matches current → allow login
    5. If `deviceId` differs → `signOut` immediately and show error
       - AR: "هذا الحساب مفعّل على جهاز آخر. تواصل مع الدعم لإعادة تعيين الجهاز."
       - EN: "This account is registered on another device. Contact support to reset the device."
  - Device mismatch is NOT counted as a failed-attempt (credentials are valid; only device is wrong).
- **Admin (`/app/frontend/public/admin.html`)**:
  - Each user row shows a device badge ("مربوط بجهاز" / "بدون جهاز") + the deviceId + registration date + user-agent.
  - New "إعادة تعيين الجهاز" button per user → confirms then sets `deviceId`, `deviceInfo`, `deviceRegisteredAt` to `null` and records `deviceResetAt`. After reset the client can sign in from a new device.
  - Info card updated to document the device-lock behaviour.

### Previously implemented (kept)
- Bilingual login (AR/EN), 5 attempts / 15 min lockout, WhatsApp support button.
- Lifetime subscription offer card on login page.
- QR generation + Card generation flows (unchanged).

## How it works (admin flow)
1. Admin creates client account in `/admin.html` → user has `active:true`, no `deviceId`.
2. Client signs in for the 1st time → app writes `deviceId` to that user's record.
3. Same client opens the app on any other device with same email/password → app reads `deviceId`, mismatch → blocked.
4. To migrate the client to a new device, the admin opens `/admin.html` → finds the user → clicks **"إعادة تعيين الجهاز"** → client signs in on the new device → new `deviceId` is bound.

## Backlog
- P1: Show device-reset history (log of resets) in admin panel
- P2: Allow client to "request device reset" via a WhatsApp deep link prefilled with email + UID
- P2: Optional concurrent-session limit (sign-out other sessions instead of blocking)
