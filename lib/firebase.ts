import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAgWsw0KrEKH-uuqcucwwDHEUaCwCdUDI0",
  authDomain: "uni-app-14de6.firebaseapp.com",
  projectId: "uni-app-14de6",
  storageBucket: "uni-app-14de6.firebasestorage.app",
  messagingSenderId: "333220791975",
  appId: "1:333220791975:web:1aca5fdb3998627b6e3d82",
  measurementId: "G-8T8CVTSLE3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
