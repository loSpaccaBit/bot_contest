'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '@/lib/api';
import type { UpdateSystemSettingDto } from '@domusbet/shared-types';

export const SETTINGS_KEY = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: settingsApi.getAll,
    staleTime: 60_000,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, dto }: { key: string; dto: UpdateSystemSettingDto }) =>
      settingsApi.update(key, dto),
    onSuccess: () => {
      toast.success('Impostazione salvata');
      void qc.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
    onError: () => toast.error('Errore nel salvataggio'),
  });
}
