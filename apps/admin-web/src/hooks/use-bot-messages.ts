'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { botMessagesApi } from '@/lib/api';
import type { UpdateBotMessageTemplateDto } from '@domusbet/shared-types';

export const BOT_MESSAGES_KEY = ['bot-messages'] as const;

export function useBotMessages() {
  return useQuery({
    queryKey: BOT_MESSAGES_KEY,
    queryFn: botMessagesApi.getAll,
    staleTime: 60_000,
  });
}

export function useUpdateBotMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBotMessageTemplateDto }) =>
      botMessagesApi.update(id, dto),
    onSuccess: () => {
      toast.success('Messaggio aggiornato');
      void qc.invalidateQueries({ queryKey: BOT_MESSAGES_KEY });
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });
}
