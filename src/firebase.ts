// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8bw8Ue-G8hE_DwQJvlijMp8AUlG_DLes",
  authDomain: "test-project-5a46c.firebaseapp.com",
  databaseURL:
    "https://test-project-5a46c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-project-5a46c",
  storageBucket: "test-project-5a46c.firebasestorage.app",
  messagingSenderId: "888792132716",
  appId: "1:888792132716:web:b84bb422db157b74b0fc49",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
