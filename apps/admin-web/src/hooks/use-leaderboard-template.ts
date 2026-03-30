'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { leaderboardTemplateApi } from '@/lib/api';
import type { UpdateLeaderboardTemplateDto } from '@/lib/api';

export const LEADERBOARD_TEMPLATE_KEY = ['leaderboard-templates'] as const;

export function useLeaderboardTemplates() {
  return useQuery({
    queryKey: [...LEADERBOARD_TEMPLATE_KEY],
    queryFn: () => leaderboardTemplateApi.getAll(),
    staleTime: 10_000,
  });
}

export function useCreateLeaderboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, image }: { name: string; image: File }) =>
      leaderboardTemplateApi.create(name, image),
    onSuccess: () => {
      toast.success('Template caricato con successo');
      void qc.invalidateQueries({ queryKey: LEADERBOARD_TEMPLATE_KEY });
    },
    onError: () => toast.error('Errore durante il caricamento del template'),
  });
}

export function useUpdateLeaderboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLeaderboardTemplateDto }) =>
      leaderboardTemplateApi.update(id, dto),
    onSuccess: () => {
      toast.success('Template aggiornato');
      void qc.invalidateQueries({ queryKey: LEADERBOARD_TEMPLATE_KEY });
    },
    onError: () => toast.error("Errore durante l'aggiornamento del template"),
  });
}

export function useDeleteLeaderboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaderboardTemplateApi.delete(id),
    onSuccess: () => {
      toast.success('Template eliminato');
      void qc.invalidateQueries({ queryKey: LEADERBOARD_TEMPLATE_KEY });
    },
    onError: () => toast.error("Errore durante l'eliminazione del template"),
  });
}
