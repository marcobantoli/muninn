import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKALt2s9r-KiipsCCG1hJGhV0Vpz5IwZU",
  authDomain: "muninn-22437.firebaseapp.com",
  projectId: "muninn-22437",
  storageBucket: "muninn-22437.firebasestorage.app",
  messagingSenderId: "981209117207",
  appId: "1:981209117207:web:5b500da1b00ee0d817e252"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
