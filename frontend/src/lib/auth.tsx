import { createContext, useContext, useState, type ReactNode } from 'react';
import { clearSession } from './api';

export type UserType = 'customer' | 'admin' | 'superadmin';

interface AuthState {
  token: string | null;
  username: string | null;
  userType: UserType | null;
  partyName: string | null;
  // false = must set a PIN (dealer) / password (staff) before using the app.
  isPasswordReset: boolean;
}

interface AuthContextValue {
  auth: AuthState;
  isAuthenticated: boolean;
  login: (token: string, username: string, userType: UserType, partyName: string, isPasswordReset: boolean) => void;
  markSetupDone: () => void;
  logout: () => void;
}

const readStored = (): AuthState => ({
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  userType: localStorage.getItem('userType') as UserType | null,
  partyName: localStorage.getItem('partyName'),
  // Absent (older sessions) is treated as done, so we never trap an existing login.
  isPasswordReset: localStorage.getItem('isPasswordReset') !== 'false',
});

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(readStored);

  const login: AuthContextValue['login'] = (token, username, userType, partyName, isPasswordReset) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    localStorage.setItem('userType', userType);
    localStorage.setItem('partyName', partyName);
    localStorage.setItem('isPasswordReset', String(isPasswordReset));
    setAuth({ token, username, userType, partyName, isPasswordReset });
  };

  const markSetupDone = () => {
    localStorage.setItem('isPasswordReset', 'true');
    setAuth((a) => ({ ...a, isPasswordReset: true }));
  };

  const logout = () => {
    clearSession();
    localStorage.removeItem('isPasswordReset');
    setAuth({ token: null, username: null, userType: null, partyName: null, isPasswordReset: true });
  };

  return (
    <AuthContext.Provider value={{ auth, isAuthenticated: !!auth.token, login, markSetupDone, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** The landing route for each role. */
export function homeForRole(userType: UserType | null): string {
  switch (userType) {
    case 'admin': return '/admin';
    case 'superadmin': return '/superadmin';
    case 'customer': return '/home';
    default: return '/';
  }
}

/** Where a user who hasn't set their credential must go first. */
export function setupRouteFor(userType: UserType | null): string {
  return userType === 'customer' ? '/set-pin' : '/reset-password';
}
