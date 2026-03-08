import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Step 1: Create the context object
const AuthContext = createContext(null);

// Step 2: Create the Provider component
// This wraps the whole app and makes user data available everywhere
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the current session when the app loads
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for login/logout events and update state automatically
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup: stop listening when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Step 3: Custom hook so any component can easily access the user
// Usage in any component: const { user, loading } = useAuth()
export function useAuth() {
  return useContext(AuthContext);
}
