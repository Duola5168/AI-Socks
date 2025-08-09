import { initializeApp, type FirebaseApp } from "@firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "@firebase/auth";
import { getFirestore, Firestore } from "@firebase/firestore";
import { config, IS_FIREBASE_CONFIGURED } from './config';

// Re-export the configuration status for easy import elsewhere
export { IS_FIREBASE_CONFIGURED };

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let googleProvider: GoogleAuthProvider | null = null;

// Initialize Firebase only if configured, preventing runtime errors.
if (IS_FIREBASE_CONFIGURED) {
    try {
        app = initializeApp(config.firebase);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
    } catch (e) {
        console.error("Firebase initialization error:", e);
        // Set all to null to signal failure
        app = null;
        auth = null;
        db = null;
        googleProvider = null;
    }
}