import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { auth, googleProvider, IS_FIREBASE_CONFIGURED, db } from '../services/firebase';
import { signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut, User } from '@firebase/auth';
import { doc, getDoc, setDoc } from '@firebase/firestore';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => void;
    signOut: () => void;
    isFirebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!IS_FIREBASE_CONFIGURED || !auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && db) {
                // Check if user exists in Firestore, if not, create a document
                const userDocRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userDocRef);
                if (!docSnap.exists()) {
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        createdAt: new Date().toISOString(),
                    });
                }
            }
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        if (!IS_FIREBASE_CONFIGURED || !auth || !googleProvider) return;
        setLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Error signing in with Google: ", error);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        if (!IS_FIREBASE_CONFIGURED || !auth) return;
        setLoading(true);
        try {
            await firebaseSignOut(auth);
            setUser(null);
        } catch (error) {
            console.error("Error signing out: ", error);
        } finally {
            setLoading(false);
        }
    };

    const value = {
        user,
        loading,
        signInWithGoogle,
        signOut,
        isFirebaseConfigured: IS_FIREBASE_CONFIGURED,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};