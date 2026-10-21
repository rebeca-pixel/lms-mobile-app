import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '@/lib/data';
import { supabase } from '@/lib/supabaseClient';
import { useLocation } from 'wouter';
import { stopBackgroundSync } from '@/lib/pushNotifications';

interface AuthContextType {
  user: User | null;
  login: (code: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check localStorage for persisted session on mount
    const savedUser = localStorage.getItem('leave_manager_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user', err);
        localStorage.removeItem('leave_manager_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (code: string, password?: string) => {
    try {
      const normalizedCode = code.toString().trim();

      // 1. Require both fields
      if (!normalizedCode || !password) {
        return false;
      }

      // 2. Fetch user by employee code (case-insensitive)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.${normalizedCode},user_id.ilike.${normalizedCode}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Supabase login error', error);
        return false;
      }

      // 3. If user not found → fail
      if (!data) {
        return false;
      }

      // 4. Check password strictly
      if (data.password !== password) {
        return false;
      }

      // 5. Map role
      const dbRole = (data.role || 'employee').toString().toLowerCase();
      const mappedRole: Role =
        dbRole === 'admin' ? 'Admin' : dbRole === 'hr' ? 'HR' : 'Employee';

      const foundUser: User = {
        id: String(data.user_id || data.username),
        code: data.username || data.user_id,
        name: data.name || data.username,
        role: mappedRole,
        designation: data.designation || '',
        email: data.email || undefined,
      };

      setUser(foundUser);
      localStorage.setItem('leave_manager_user', JSON.stringify(foundUser));
      return true;

    } catch (err) {
      console.error('Login failed', err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('leave_manager_user');
    stopBackgroundSync();
    setLocation('/');
  };

  // Re-fetch the user's latest profile from the DB and update `user` in memory.
  const refreshUser = async (identifier?: string) => {
    try {
      const code = identifier || (user?.code || user?.id || '');
      if (!code) return;
      const { data: fresh, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${code},user_id.eq.${code}`)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Error refreshing user profile', error);
        return;
      }
      if (!fresh) return;
      const dbRole = (fresh?.role || 'employee').toString().toLowerCase();
      const mappedRole: Role = dbRole === 'admin' ? 'Admin' : dbRole === 'hr' ? 'HR' : 'Employee';
      const updated: User = {
        id: String(fresh?.user_id || fresh?.username || ''),
        code: fresh?.username || fresh?.user_id || '',
        name: fresh?.name || fresh?.username || '',
        role: mappedRole,
        designation: fresh?.designation || '',
        email: fresh?.email || undefined,
      };
      setUser(updated);
    } catch (err) {
      console.error('refreshUser failed', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
