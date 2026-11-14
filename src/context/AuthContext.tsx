import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { ensureUserDocuments } from '../services/firestoreService';
import type { UserPrivate, UserPublic } from '../types/domain';

interface AuthContextValue {
  firebaseUser: User | null;
  userPublic: UserPublic | null;
  userPrivate: UserPrivate | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  signInWithGoogle: (preferredRole?: 'student' | 'owner') => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BOOTSTRAPPED_ADMIN_EMAIL = 'aceclazzo360@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userPublic, setUserPublic] = useState<UserPublic | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);

  const loadProfile = useCallback(async (user: User, preferredRole?: 'student' | 'owner') => {
    try {
      const { pub, priv } = await ensureUserDocuments({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? 'ToStay Member',
        photoUrl: user.photoURL ?? undefined,
        preferredRole,
      });
      setUserPublic(pub);
      setUserPrivate(priv);

      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      setIsAdminDoc(adminSnap.exists());
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile(user);
      } else {
        setUserPublic(null);
        setUserPrivate(null);
        setIsAdminDoc(false);
      }
      setIsAuthReady(true);
    });
    return () => unsub();
  }, [loadProfile]);

  const signInWithGoogle = useCallback(
    async (preferredRole?: 'student' | 'owner') => {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await loadProfile(cred.user, preferredRole);
      }
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (firebaseUser) {
      await loadProfile(firebaseUser);
    }
  }, [firebaseUser, loadProfile]);

  const isAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    (firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL || isAdminDoc);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userPublic,
        userPrivate,
        isAuthReady,
        isAdmin,
        signInWithGoogle,
        signOut,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
