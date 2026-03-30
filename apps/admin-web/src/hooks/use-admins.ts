'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminsApi } from '@/lib/api';
import type { CreateAdminDto, UpdateAdminDto, AdminFiltersDto } from '@domusbet/shared-types';

export const ADMINS_KEY = ['admins'] as const;

export function useAdmins(filters?: AdminFiltersDto) {
  return useQuery({
    queryKey: [...ADMINS_KEY, filters],
    queryFn: () => adminsApi.getAll(filters),
    staleTime: 30_000,
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAdminDto) => adminsApi.create(dto),
    onSuccess: () => {
      toast.success('Amministratore creato');
      void qc.invalidateQueries({ queryKey: ADMINS_KEY });
    },
    onError: () => toast.error('Errore nella creazione'),
  });
}

export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAdminDto }) =>
      adminsApi.update(id, dto),
    onSuccess: () => {
      toast.success('Amministratore aggiornato');
      void qc.invalidateQueries({ queryKey: ADMINS_KEY });
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });
}

export function useDeleteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminsApi.delete,
    onSuccess: () => {
      toast.success('Amministratore eliminato');
      void qc.invalidateQueries({ queryKey: ADMINS_KEY });
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });
}
