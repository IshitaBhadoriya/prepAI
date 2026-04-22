import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { saveUser } from "../lib/database";
import { AuthContext } from "./authState";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    setUser(authUser ?? null);
    return authUser ?? null;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      setLoading(false);

      // When a user signs in, save them to our users table
      // upsert means it's safe to call every login — won't create duplicates
      if (authUser && _event === "SIGNED_IN") {
        setTimeout(() => {
          void saveUser(authUser);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

