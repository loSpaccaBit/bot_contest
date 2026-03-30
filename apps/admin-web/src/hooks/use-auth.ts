'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { setTokens, clearTokens } from '@/lib/auth';
import { useAuthContext } from '@/providers/auth-provider';

export function useAuth() {
  return useAuthContext();
}

export function useLogin() {
  const router = useRouter();
  const { refetch } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await refetch();
      await queryClient.invalidateQueries();
      toast.success('Accesso effettuato');
      router.push('/dashboard');
    },
    onError: () => {
      toast.error('Credenziali non valide');
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const { refetch } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: async () => {
      clearTokens();
      queryClient.clear();
      await refetch();
      router.push('/login');
    },
  });
}
