import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDag8IjhCfquweo20fTChWpumh8U_z-9HE",
  authDomain: "recordinter1.firebaseapp.com",
  projectId: "recordinter1",
  storageBucket: "recordinter1.firebasestorage.app",
  messagingSenderId: "379117695366",
  appId: "1:379117695366:web:4dd750015f00f6ac173c07",
  measurementId: "G-TK6HQF80X2"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };