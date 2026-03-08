import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyDKALt2s9r-KiipsCCG1hJGhV0Vpz5IwZU',
    authDomain: 'muninn-22437.firebaseapp.com',
    projectId: 'muninn-22437',
    storageBucket: 'muninn-22437.firebasestorage.app',
    messagingSenderId: '981209117207',
    appId: '1:981209117207:web:5b500da1b00ee0d817e252'
};

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

function getFirebaseApp(): FirebaseApp {
    if (firebaseApp) {
        return firebaseApp;
    }

    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return firebaseApp;
}

export function getFirestoreDb(): Firestore {
    if (firestoreDb) {
        return firestoreDb;
    }

    firestoreDb = getFirestore(getFirebaseApp());
    return firestoreDb;
}