import admin from "firebase-admin";

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : null;

if (!privateKey) {
  console.warn("⚠️ FIREBASE_PRIVATE_KEY missing. Firebase disabled.");
}

let app = null;
let db = null;

if (privateKey) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  db = admin.firestore();
}

export { admin, db };
