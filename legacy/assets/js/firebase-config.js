// Firebase Configuration
// IMPORTANT: Replace the following config with your own Firebase project configuration
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
