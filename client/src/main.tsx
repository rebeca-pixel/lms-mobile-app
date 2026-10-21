import { createRoot } from "react-dom/client";
import { initNativeBridge } from "./native/bridge";
import App from "./App";
import "./index.css";

// Mobile-only: API base URL, native downloads, back button, status bar (no-op in a browser).
initNativeBridge();

// Clear legacy localStorage keys so app relies only on Supabase for persistence
if (typeof window !== 'undefined' && window.localStorage) {
	const keysToRemove = ['knockturn_current_user', 'user_id', 'knockturn_users', 'knockturn_leaves', 'knockturn_user'];
	keysToRemove.forEach(k => localStorage.removeItem(k));
}

createRoot(document.getElementById("root")!).render(<App />);
