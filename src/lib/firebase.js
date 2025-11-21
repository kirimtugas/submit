import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCc6eXP16jU3z4EKYowp9vmp1mhxD-Rhv0",
    authDomain: "kirimtugas-app.firebaseapp.com",
    projectId: "kirimtugas-app",
    storageBucket: "kirimtugas-app.firebasestorage.app",
    messagingSenderId: "834165771444",
    appId: "1:834165771444:web:2e622e0d85dc1b3f489be1",
    measurementId: "G-9ZQC3VF7EX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
