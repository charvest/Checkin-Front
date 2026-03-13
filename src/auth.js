// src/auth.js

import { initializeApp } from "firebase/app";

// Firebase Auth
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDry-vQlHO-5f9vgHHlcLDwkiOPdxzDvyw",
  authDomain: "checkin-2be12.firebaseapp.com",
  projectId: "checkin-2be12",
  storageBucket: "checkin-2be12.firebasestorage.app",
  messagingSenderId: "648158463578",
  appId: "1:648158463578:web:761e87da381d2a71c27a63",
  measurementId: "G-MQJ4PP49P4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// OPTIONAL analytics (can comment out if it causes issues)
// const analytics = getAnalytics(app);

// Initialize Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/**
 * Google Sign In
 */
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);

    const user = {
      uid: result.user.uid,
      name: result.user.displayName,
      email: result.user.email,
      photo: result.user.photoURL,
    };

    console.log("Google User:", user);
    return user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

/**
 * Logout
 */
const logout = async () => {
  try {
    await signOut(auth);
    console.log("User signed out");
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

export { auth, signInWithGoogle, logout };
