// src/services/firebaseConfig.js
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA95AB_ZtRvGlaw-lvcbcWyyNyloX9teb8",
  authDomain: "terapia-471517.firebaseapp.com",
  projectId: "terapia-471517",
  storageBucket: "terapia-471517.firebasestorage.app",
  messagingSenderId: "826777844588",
  appId: "1:826777844588:web:780669d2562ce464ce9149",
  measurementId: "G-2EFWC5DH6X"
};

const app = initializeApp(firebaseConfig);

// CLAVE: inicializar Auth con persistencias duraderas y resolver de popup/redirect
export const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  ],
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const db = getFirestore(app);
