export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "admin" | "engineer" | "guest";
  initials: string;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email?: string, name?: string) => void;
  logout: () => void;
}
