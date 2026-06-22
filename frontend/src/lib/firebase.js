import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

/* Shared Firebase instance (same project used by admin.html) */
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

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getDatabase(firebaseApp);
