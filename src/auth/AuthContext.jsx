import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut }                    from 'firebase/auth';
import { auth }                                           from '../firebase';
import { getUser, subscribeToUser }                       from '../firestoreService';

const AuthContext = createContext(null);
const ALLOWED_DOMAINS = ['rcs-k12.us', 'rochester.k12.mi.us'];

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = still loading
  const [userDoc,      setUserDoc]      = useState(null);
  const [domainError,  setDomainError]  = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) { setFirebaseUser(null); setUserDoc(null); return; }

      const domain = fbUser.email?.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain)) {
        await signOut(auth);
        setFirebaseUser(null);
        setDomainError(true);
        return;
      }
      setDomainError(false);
      setFirebaseUser(fbUser);
      setUserDoc(await getUser(fbUser.uid));
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    return subscribeToUser(firebaseUser.uid, setUserDoc);
  }, [firebaseUser?.uid]);

  const loading         = firebaseUser === undefined;
  const isLoggedIn      = !!firebaseUser;
  const needsOnboarding = isLoggedIn && !loading && !userDoc?.school;
  const role            = userDoc?.role       ?? 'student';
  const school          = userDoc?.school     ?? '';
  const superAdmin      = userDoc?.superAdmin ?? false;
  const displayName     = userDoc?.displayName ?? firebaseUser?.displayName ?? '';

  return (
    <AuthContext.Provider value={{
      firebaseUser, userDoc, loading, isLoggedIn, needsOnboarding,
      role, school, superAdmin, displayName, domainError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
