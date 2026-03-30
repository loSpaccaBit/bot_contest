'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { scoreRulesApi } from '@/lib/api';
import type { CreateScoreRuleDto, UpdateScoreRuleDto } from '@domusbet/shared-types';

export const SCORE_RULES_KEY = ['score-rules'] as const;

export function useScoreRules() {
  return useQuery({
    queryKey: SCORE_RULES_KEY,
    queryFn: scoreRulesApi.getAll,
    staleTime: 30_000,
  });
}

export function useCreateScoreRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateScoreRuleDto) => scoreRulesApi.create(dto),
    onSuccess: () => {
      toast.success('Regola creata');
      void qc.invalidateQueries({ queryKey: SCORE_RULES_KEY });
    },
    onError: () => toast.error('Errore nella creazione'),
  });
}

export function useUpdateScoreRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateScoreRuleDto }) =>
      scoreRulesApi.update(id, dto),
    onSuccess: () => {
      toast.success('Regola aggiornata');
      void qc.invalidateQueries({ queryKey: SCORE_RULES_KEY });
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });
}

export function useDeleteScoreRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scoreRulesApi.delete,
    onSuccess: () => {
      toast.success('Regola eliminata');
      void qc.invalidateQueries({ queryKey: SCORE_RULES_KEY });
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });
}
