'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { AdminDto } from '@domusbet/shared-types';
import { authApi } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

interface AuthContextValue {
  admin: AdminDto | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  admin: null,
  isLoading: true,
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = async () => {
    const token = getAccessToken();
    if (!token) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    try {
      const me = await authApi.getMe();
      setAdmin(me);
    } catch {
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMe();
  }, []);

  return (
    <AuthContext.Provider value={{ admin, isLoading, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
