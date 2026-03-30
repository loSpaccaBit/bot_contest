'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submissionsApi } from '@/lib/api';
import type {
  SubmissionFiltersDto,
  ApproveSubmissionDto,
  RejectSubmissionDto,
  AssignPointsDto,
} from '@domusbet/shared-types';

export const SUBMISSIONS_KEY = ['submissions'] as const;

export function useSubmissions(filters?: SubmissionFiltersDto) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, filters],
    queryFn: () => submissionsApi.getAll(filters),
    staleTime: 5_000,
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, id],
    queryFn: () => submissionsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useApproveSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Omit<ApproveSubmissionDto, 'submissionId'>;
    }) => submissionsApi.approve(id, dto),
    onSuccess: () => {
      toast.success('Segnalazione approvata');
      void qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
    },
    onError: () => toast.error("Errore durante l'approvazione"),
  });
}

export function useRejectSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Omit<RejectSubmissionDto, 'submissionId'>;
    }) => submissionsApi.reject(id, dto),
    onSuccess: () => {
      toast.success('Segnalazione rifiutata');
      void qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
    },
    onError: () => toast.error('Errore durante il rifiuto'),
  });
}

export function useAssignPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Omit<AssignPointsDto, 'submissionId'>;
    }) => submissionsApi.assignPoints(id, dto),
    onSuccess: () => {
      toast.success('Punti assegnati');
      void qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
    },
    onError: () => toast.error("Errore nell'assegnazione punti"),
  });
}

export function useUnapproveSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => submissionsApi.unapprove(id),
    onSuccess: () => {
      toast.success('Approvazione annullata');
      void qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
    },
    onError: () => toast.error("Errore durante l'annullamento"),
  });
}

export function useDeleteScoreMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, movementId }: { submissionId: string; movementId: string }) =>
      submissionsApi.deleteScoreMovement(submissionId, movementId),
    onSuccess: () => {
      toast.success('Assegnazione punti annullata');
      void qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
    },
    onError: () => toast.error("Errore durante l'annullamento dei punti"),
  });
}
