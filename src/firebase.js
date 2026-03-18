import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBTBRT35FnbMcwV0x1fJyKnRKZzo4YuBI8",
  authDomain: "budget-8076f.firebaseapp.com",
  projectId: "budget-8076f",
  storageBucket: "budget-8076f.firebasestorage.app",
  messagingSenderId: "878286717077",
  appId: "1:878286717077:web:2fa2c90b5ca1b05771db9c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);