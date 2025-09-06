// services/config.ts
export const config = {
    // Gemini
    geminiApiKey: (import.meta as any).env?.VITE_API_KEY || '',

    // Groq
    groqApiKey: (import.meta as any).env?.VITE_GROQ_API_KEY || '',

    // News API (Primary - Webz.io)
    news2ApiKey: (import.meta as any).env?.VITE_NEWS2_API_KEY || '',
    // News API (Fallback - NewsAPI.org)
    newsApiKey: (import.meta as any).env?.VITE_NEWS_API_KEY || '',
    
    // Firebase Cloud Function URL
    firebaseFunctionsUrl: (import.meta as any).env?.VITE_FIREBASE_FUNCTIONS_URL || '',
    
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
    
    // Supabase
    supabase: {
        url: (import.meta as any).env?.VITE_SUPABASE_URL,
        anonKey: (import.meta as any).env?.VITE_SUPABASE_KEY,
    },

    // Brevo (Email)
    brevoApiKey: (import.meta as any).env?.VITE_BREVO_API_KEY || '',
    userEmail: (import.meta as any).env?.VITE_USER_EMAIL || '',
};

export const IS_SUPABASE_CONFIGURED = !!config.supabase.url && !!config.supabase.anonKey;
export const IS_PROXY_CONFIGURED = true;
export const IS_GEMINI_CONFIGURED = !!config.geminiApiKey;
export const IS_GROQ_CONFIGURED = !!config.groqApiKey;
export const IS_FINMIND_CONFIGURED = true;
export const IS_GITHUB_CONFIGURED = true; 
export const IS_NEWS_CONFIGURED = !!config.newsApiKey;
export const IS_NEWS2_CONFIGURED = !!config.news2ApiKey;
export const IS_FIREBASE_CONFIGURED = !!config.firebase.apiKey && !!config.firebase.authDomain && !!config.firebase.projectId;
export const IS_FIREBASE_FUNCTIONS_CONFIGURED = !!config.firebaseFunctionsUrl;
export const IS_BREVO_CONFIGURED = !!config.brevoApiKey && !!config.userEmail;