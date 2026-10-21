import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, INITIAL_USERS } from "@/lib/data";
import { useLocation } from "wouter";

interface UserContextType {
  user: User | null;
  login: (code: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Do not persist user to localStorage; session is in-memory only.
    setIsLoading(false);
  }, []);

  const login = async (code: string) => {
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const foundUser = INITIAL_USERS.find((u) => u.code === code);

    if (foundUser) {
      setUser(foundUser);
      // Do not persist to localStorage in production; rely on DB session
      
      // Redirect based on role
      if (foundUser.role === 'Admin') {
        setLocation('/admin/dashboard');
      } else {
        setLocation('/employee/dashboard');
      }
      
      return { success: true };
    }

    return { success: false, message: "Invalid Employee Code" };
  };

  const logout = () => {
    setUser(null);
    // session cleared in memory
    setLocation("/");
  };

  return (
    <UserContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
