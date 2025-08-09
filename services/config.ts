// services/config.ts
export const config = {
    // Gemini
    geminiApiKey: (import.meta as any).env?.VITE_API_KEY || '',

    // Groq
    groqApiKey: (import.meta as any).env?.VITE_GROQ_API_KEY || '',

    // News API
    newsApiKey: (import.meta as any).env?.VITE_NEWS_API_KEY || '',

    // Firebase
    firebase: {
        apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
        authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
        storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID,
        measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID,
    },

    // Brevo (Email)
    brevoApiKey: (import.meta as any).env?.VITE_BREVO_API_KEY || '',
    userEmail: (import.meta as any).env?.VITE_USER_EMAIL || '',
};

// The Netlify function proxy is now a core part of the app.
// We assume it's available. The function itself will handle missing backend tokens.
export const IS_PROXY_CONFIGURED = true;
export const IS_GEMINI_CONFIGURED = !!config.geminiApiKey;
export const IS_GROQ_CONFIGURED = !!config.groqApiKey;
// FinMind is accessed via the built-in proxy, so from the frontend's perspective,
// it is always configured. The backend will return an error if the token is missing.
export const IS_FINMIND_CONFIGURED = true;
export const IS_NEWS_CONFIGURED = !!config.newsApiKey;
export const IS_FIREBASE_CONFIGURED = !!config.firebase.apiKey && !!config.firebase.authDomain && !!config.firebase.projectId;
export const IS_BREVO_CONFIGURED = !!config.brevoApiKey && !!config.userEmail;