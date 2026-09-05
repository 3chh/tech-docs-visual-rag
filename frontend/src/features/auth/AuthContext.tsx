import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { AuthState, UserProfile } from "./types";

const DEFAULT_USER: UserProfile = {
  id: "user_engineer_01",
  name: "Kỹ sư Vũ Thành Trung",
  email: "trung.vu@cosmo.ai",
  role: "engineer",
  initials: "VT",
};

const STORAGE_KEY = "cosmo_chatpdf_auth";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_USER;
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [user]);

  function login(email = "trung.vu@cosmo.ai", name = "Kỹ sư Vũ Thành Trung") {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .slice(-2)
      .join("")
      .toUpperCase();

    setUser({
      id: crypto.randomUUID(),
      name,
      email,
      role: "engineer",
      initials,
    });
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
