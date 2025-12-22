import admin from 'firebase-admin';
import { getFirestore as getFirestoreDb } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';

let db;
let rtdb;
let app;

export function initializeFirebase() {
  // Check for service account file
  const serviceAccountPath = './serviceAccountKey.json';

  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://quest-war-default-rtdb.asia-southeast1.firebasedatabase.app/"
    });
  } else {
    // Use default credentials (for Cloud Run)
    app = admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  }

  // Use the specific database 'questwardb'
  db = getFirestoreDb(app, 'questwardb');

  try {
    rtdb = admin.database();
    console.log('Firebase initialized successfully (with RTDB)');
  } catch (err) {
    console.error('Failed to initialize RTDB:', err);
  }
}

export function getFirestore() {
  return db;
}

export function getRealtimeDb() {
  return rtdb;
}

export { admin };
