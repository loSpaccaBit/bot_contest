'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBotMessages, useUpdateBotMessage } from '@/hooks/use-bot-messages';
import { PageHeader } from '@/components/common/page-header';
import { PageLoader } from '@/components/common/loading-spinner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { BOT_MESSAGE_PLACEHOLDERS } from '@domusbet/shared-types';
import type { BotMessageTemplateDto, UpdateBotMessageTemplateDto, BotMessageKey } from '@domusbet/shared-types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

// ─── Variable descriptions ────────────────────────────────────────────────────

const VAR_DESCRIPTIONS: Record<string, string> = {
  firstName: 'Nome utente Telegram',
  lastName: 'Cognome utente Telegram',
  appName: 'Nome applicazione',
  domusbetUsername: 'Username Domusbet segnalato',
  points: 'Punti guadagnati con questa segnalazione',
  totalPoints: 'Punti totali accumulati dal referrer',
  totalSubmissions: 'Numero totale di segnalazioni',
  approvedSubmissions: 'Segnalazioni approvate',
  pendingSubmissions: 'Segnalazioni in attesa',
  rejectedSubmissions: 'Segnalazioni rifiutate',
  rank: 'Posizione in classifica',
  rejectionReason: 'Motivo del rifiuto (da admin)',
  entries: 'Elenco posizioni classifica (generato automaticamente)',
  errorCode: 'Codice errore tecnico',
  linkBot: 'Link personale al bot — usa come [testo]({linkBot})',
  linkCanale: 'Invite link unico al canale Domusbet — usa come [testo]({linkCanale})',
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  content: z.string().min(1, 'Contenuto obbligatorio'),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type MessageFormData = z.infer<typeof messageSchema>;

// ─── Main component ───────────────────────────────────────────────────────────

export function BotMessagesContent() {
  const { data: messages, isLoading } = useBotMessages();
  const updateMessage = useUpdateBotMessage();

  const [editingMessage, setEditingMessage] = useState<BotMessageTemplateDto | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
  });

  const openEdit = (msg: BotMessageTemplateDto) => {
    setEditingMessage(msg);
    form.reset({
      name: msg.name,
      content: msg.content,
      description: msg.description ?? '',
      isActive: msg.isActive,
    });
  };

  const onSubmit = (data: MessageFormData) => {
    if (!editingMessage) return;
    const dto: UpdateBotMessageTemplateDto = {
      name: data.name,
      content: data.content,
      description: data.description,
      isActive: data.isActive,
    };
    updateMessage.mutate(
      { id: editingMessage.id, dto },
      { onSuccess: () => setEditingMessage(null) },
    );
  };

  // Insert variable token at current cursor position inside the editor textarea
  const handleInsertVar = useCallback(
    (token: string) => {
      const textarea = editorWrapperRef.current?.querySelector('textarea');
      const current = form.getValues('content') ?? '';

      if (textarea) {
        const start = textarea.selectionStart ?? current.length;
        const end = textarea.selectionEnd ?? current.length;
        const newValue = current.slice(0, start) + token + current.slice(end);
        form.setValue('content', newValue, { shouldDirty: true });
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + token.length, start + token.length);
        });
      } else {
        form.setValue('content', current + token, { shouldDirty: true });
      }
    },
    [form],
  );

  const placeholders = editingMessage
    ? (BOT_MESSAGE_PLACEHOLDERS[editingMessage.key as BotMessageKey] ?? [])
    : [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaggi Bot"
        description="Personalizza i messaggi inviati dal bot Telegram. Scrivi in Markdown — il bot converte automaticamente."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(messages ?? []).map((msg) => {
          const vars = BOT_MESSAGE_PLACEHOLDERS[msg.key as BotMessageKey] ?? [];
          return (
            <Card key={msg.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold text-slate-900">{msg.name}</CardTitle>
                    <code className="text-xs text-slate-500 font-mono">{msg.key}</code>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      msg.isActive
                        ? 'bg-green-50 text-green-700 border-green-200 shrink-0'
                        : 'bg-slate-50 text-slate-500 shrink-0'
                    }
                  >
                    {msg.isActive ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </div>
                {msg.description && (
                  <CardDescription className="text-xs mt-1">{msg.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {vars.map((v) => (
                      <code
                        key={v}
                        className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5 font-mono"
                      >
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                )}
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 whitespace-pre-wrap text-slate-700 max-h-28 overflow-auto font-sans">
                  {msg.content}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(msg)}
                  className="w-full"
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Modifica
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingMessage} onOpenChange={(o) => !o && setEditingMessage(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifica —{' '}
              <code className="text-sm font-mono text-slate-500">{editingMessage?.key}</code>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Name & description */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Descrizione</Label>
                <Input {...form.register('description')} />
              </div>
            </div>

            {/* Variables panel */}
            {placeholders.length > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Variabili disponibili — clicca per inserire al cursore
                </p>
                <div className="flex flex-wrap gap-2">
                  {placeholders.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVar(`{${v}}`)}
                      className="group flex flex-col items-start rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <code className="text-xs font-mono text-blue-700 group-hover:text-blue-900">
                        {`{${v}}`}
                      </code>
                      {VAR_DESCRIPTIONS[v] && (
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {VAR_DESCRIPTIONS[v]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Markdown editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Contenuto *</Label>
                <span className="text-xs text-slate-400">
                  <code className="bg-slate-100 px-1 rounded">**grassetto**</code>{' '}
                  <code className="bg-slate-100 px-1 rounded">_corsivo_</code>{' '}
                  <code className="bg-slate-100 px-1 rounded">`monospace`</code>
                </span>
              </div>
              <div ref={editorWrapperRef} data-color-mode="light">
                <Controller
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <MDEditor
                      value={field.value}
                      onChange={(val) => field.onChange(val ?? '')}
                      height={340}
                      preview="live"
                      visibleDragbar={false}
                      textareaProps={{
                        placeholder: 'Scrivi il messaggio in Markdown...',
                      }}
                    />
                  )}
                />
              </div>
              {form.formState.errors.content && (
                <p className="text-xs text-red-500">{form.formState.errors.content.message}</p>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="msgActive"
                checked={form.watch('isActive')}
                onCheckedChange={(v) => form.setValue('isActive', v)}
              />
              <Label htmlFor="msgActive">Messaggio attivo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingMessage(null)}>
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={updateMessage.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateMessage.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
