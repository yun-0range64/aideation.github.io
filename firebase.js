// firestore 저장용 firebase.js 수정
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHklv0v7a4tM25dQmmZ1jrBQbHPUURqZ8",
  authDomain: "aideation-final.firebaseapp.com",
  projectId: "aideation-final",
  storageBucket: "aideation-final.appspot.com",
  messagingSenderId: "607769666659",
  appId: "1:607769666659:web:40fe1514e8cec2c39ec456",
  measurementId: "G-NDEJDLCBKL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, query, orderBy, limit };