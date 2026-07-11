import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, phone: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':      return 'No account found with this email. Please sign up first.';
    case 'auth/wrong-password':       return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':   return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account already exists with this email. Try logging in.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':        return 'Please enter a valid email address.';
    case 'auth/too-many-requests':    return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed': return 'Email/password login is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
    default: return 'Something went wrong. Please try again.';
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      throw new Error(friendlyAuthError(e.code));
    }
  };

  const signup = async (email: string, password: string, phone: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Save profile — don't block login if this fails
      setDoc(
        doc(db, 'users', cred.user.uid, 'profile', 'settings'),
        { phone, email },
        { merge: true }
      ).catch(console.warn);
    } catch (e: any) {
      throw new Error(friendlyAuthError(e.code));
    }
  };

  const signInWithGoogle = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
