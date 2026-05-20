# Test Credentials

## Admin panel (static HTML at `/admin.html`)
- URL: `<REACT_APP_BACKEND_URL>/admin.html`
- Owner password: `LiveNet2005@@`  (hard-coded in admin.html, line `const OWNER_PASSWORD = ...`)

## Firebase project
- Project: `a7d-qr-generator`
- Auth: Email/Password (managed entirely via the admin panel — create users from there)
- Realtime DB path for user records: `users/{uid}` with shape:
  ```json
  {
    "email": "...",
    "name": "...",
    "active": true,
    "createdAt": 1700000000000,
    "createdBy": "admin",
    "note": "optional",
    "deviceId": "dev_xxx",            // set after the user logs in for the first time
    "deviceInfo": { "userAgent": "...", "platform": "...", "language": "..." },
    "deviceRegisteredAt": 1700000000000,
    "deviceResetAt": 1700000000000     // set when admin presses "إعادة تعيين الجهاز"
  }
  ```

## Client test user
- No test user pre-created. Create one from `/admin.html` then log in at `/`.
