
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7hrdCSBsV6QIS99E70OXvPRzrPLH_lk0",
  authDomain: "ofsp-88c9d.firebaseapp.com",
  projectId: "ofsp-88c9d",
  storageBucket: "ofsp-88c9d.firebasestorage.app",
  messagingSenderId: "278239012324",
  appId: "1:278239012324:web:249cffc214042ea127d3f1",
  measurementId: "G-1PHVC3ZYWP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseServices = {
  auth, db, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
  doc, setDoc, getDoc, onSnapshot
};
