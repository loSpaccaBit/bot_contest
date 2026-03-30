'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useScoreRules,
  useCreateScoreRule,
  useUpdateScoreRule,
  useDeleteScoreRule,
} from '@/hooks/use-score-rules';
import { PageHeader } from '@/components/common/page-header';
import { PageLoader } from '@/components/common/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import type { ScoreRuleDto, CreateScoreRuleDto, UpdateScoreRuleDto } from '@domusbet/shared-types';

const ruleSchema = z.object({
  code: z.string().min(1, 'Codice obbligatorio').regex(/^[A-Z0-9_]+$/, 'Solo lettere maiuscole, numeri e _'),
  name: z.string().min(1, 'Nome obbligatorio'),
  description: z.string().optional(),
  points: z.coerce.number().int().min(0, 'Punti non negativi'),
  isActive: z.boolean().default(true),
});

type RuleFormData = z.infer<typeof ruleSchema>;

export function ScoreRulesContent() {
  const { data: rules, isLoading } = useScoreRules();
  const createRule = useCreateScoreRule();
  const updateRule = useUpdateScoreRule();
  const deleteRule = useDeleteScoreRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoreRuleDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { code: '', name: '', description: '', points: 0, isActive: true },
  });

  const openCreate = () => {
    setEditingRule(null);
    form.reset({ code: '', name: '', description: '', points: 0, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (rule: ScoreRuleDto) => {
    setEditingRule(rule);
    form.reset({
      code: rule.code,
      name: rule.name,
      description: rule.description ?? '',
      points: rule.points,
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: RuleFormData) => {
    if (editingRule) {
      const dto: UpdateScoreRuleDto = {
        name: data.name,
        description: data.description,
        points: data.points,
        isActive: data.isActive,
      };
      updateRule.mutate(
        { id: editingRule.id, dto },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      const dto: CreateScoreRuleDto = {
        code: data.code,
        name: data.name,
        description: data.description,
        points: data.points,
        isActive: data.isActive,
      };
      createRule.mutate(dto, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    deleteRule.mutate(deletingId, { onSettled: () => setDeletingId(null) });
  };

  if (isLoading) return <PageLoader />;

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regole Punteggio"
        description="Configura come vengono assegnati i punti"
        action={
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nuova regola
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(rules ?? []).map((rule) => (
          <Card key={rule.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-sm font-semibold text-slate-900 truncate">
                    {rule.name}
                  </CardTitle>
                  <code className="text-xs text-slate-500 font-mono">{rule.code}</code>
                </div>
                <Badge
                  variant="outline"
                  className={
                    rule.isActive
                      ? 'bg-green-50 text-green-700 border-green-200 shrink-0'
                      : 'bg-slate-50 text-slate-500 shrink-0'
                  }
                >
                  {rule.isActive ? 'Attiva' : 'Inattiva'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rule.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{rule.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">{rule.points} pt</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(rule)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingId(rule.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(rules ?? []).length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <p>Nessuna regola configurata.</p>
            <Button variant="link" onClick={openCreate} className="mt-2">
              Crea la prima regola
            </Button>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Modifica regola' : 'Nuova regola punteggio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Codice *</Label>
              <Input
                placeholder="es. FIRST_REFERRAL"
                disabled={!!editingRule}
                {...form.register('code')}
              />
              {form.formState.errors.code && (
                <p className="text-xs text-red-500">{form.formState.errors.code.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="es. Prima segnalazione" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Textarea
                placeholder="Descrizione opzionale..."
                rows={2}
                {...form.register('description')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Punti *</Label>
              <Input type="number" min={0} {...form.register('points')} />
              {form.formState.errors.points && (
                <p className="text-xs text-red-500">{form.formState.errors.points.message}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={form.watch('isActive')}
                onCheckedChange={(v) => form.setValue('isActive', v)}
              />
              <Label htmlFor="isActive">Regola attiva</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingRule ? 'Salva modifiche' : 'Crea regola'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina regola</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa regola? L'azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteRule.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Elimina'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
