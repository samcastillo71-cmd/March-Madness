import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyD_si6Bs5TuaQRt3moUCBFQM_Z7K4YKmgQ",
  authDomain:        "march-madness-tournament.firebaseapp.com",
  projectId:         "march-madness-tournament",
  storageBucket:     "march-madness-tournament.firebasestorage.app",
  messagingSenderId: "286066887815",
  appId:             "1:286066887815:web:e952f707d0dd2e0f497c22",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

const provider = new GoogleAuthProvider();
// Forces account chooser every login — great for shared/school devices
provider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const logOut           = () => signOut(auth);
