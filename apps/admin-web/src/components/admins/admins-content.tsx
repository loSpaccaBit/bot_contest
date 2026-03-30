'use client';

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAdmins, useCreateAdmin, useUpdateAdmin, useDeleteAdmin } from '@/hooks/use-admins';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatDate } from '@/lib/utils';
import { AdminRole } from '@domusbet/shared-types';
import type { AdminDto, CreateAdminDto, UpdateAdminDto } from '@domusbet/shared-types';

const createSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'Minimo 8 caratteri'),
  displayName: z.string().min(1, 'Nome obbligatorio'),
  role: z.nativeEnum(AdminRole).default(AdminRole.ADMIN),
});

const updateSchema = z.object({
  email: z.string().email('Email non valida').optional(),
  displayName: z.string().min(1, 'Nome obbligatorio').optional(),
  role: z.nativeEnum(AdminRole).optional(),
  isActive: z.boolean().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type UpdateFormData = z.infer<typeof updateSchema>;

const roleColors: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: 'bg-purple-100 text-purple-800 border-purple-200',
  [AdminRole.ADMIN]: 'bg-blue-100 text-blue-800 border-blue-200',
  [AdminRole.VIEWER]: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function AdminsContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useAdmins({ page, limit: 20, search: search || undefined });
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: AdminRole.ADMIN },
  });

  const updateForm = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
  });

  const openCreate = () => {
    createForm.reset({ email: '', password: '', displayName: '', role: AdminRole.ADMIN });
    setDialogMode('create');
  };

  const openEdit = (admin: AdminDto) => {
    setEditingAdmin(admin);
    updateForm.reset({
      email: admin.email,
      displayName: admin.displayName,
      role: admin.role,
      isActive: admin.isActive,
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingAdmin(null);
  };

  const onCreateSubmit = (data: CreateFormData) => {
    const dto: CreateAdminDto = data;
    createAdmin.mutate(dto, { onSuccess: closeDialog });
  };

  const onUpdateSubmit = (data: UpdateFormData) => {
    if (!editingAdmin) return;
    const dto: UpdateAdminDto = data;
    updateAdmin.mutate({ id: editingAdmin.id, dto }, { onSuccess: closeDialog });
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    deleteAdmin.mutate(deletingId, { onSettled: () => setDeletingId(null) });
  };

  const columns: ColumnDef<AdminDto>[] = [
    {
      accessorKey: 'displayName',
      header: 'Nome',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900">{row.original.displayName}</p>
          <p className="text-xs text-slate-500">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Ruolo',
      cell: ({ row }) => (
        <Badge variant="outline" className={roleColors[row.original.role]}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Stato',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            Attivo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-slate-500">
            Inattivo
          </Badge>
        ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Ultimo accesso',
      cell: ({ row }) => (
        <span className="text-slate-500 text-sm">
          {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(row.original)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeletingId(row.original.id)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Amministratori"
        description="Gestisci gli account admin del pannello"
        action={
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo admin
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Cerca per nome o email..."
        searchValue={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        pagination={
          data?.meta
            ? { ...data.meta, onPageChange: setPage }
            : undefined
        }
        emptyMessage="Nessun amministratore trovato"
      />

      {/* Create Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo amministratore</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome visualizzato *</Label>
              <Input {...createForm.register('displayName')} />
              {createForm.formState.errors.displayName && (
                <p className="text-xs text-red-500">{createForm.formState.errors.displayName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" {...createForm.register('email')} />
              {createForm.formState.errors.email && (
                <p className="text-xs text-red-500">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" {...createForm.register('password')} />
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-500">{createForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select
                defaultValue={AdminRole.ADMIN}
                onValueChange={(v) => createForm.setValue('role', v as AdminRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AdminRole.SUPER_ADMIN}>Super Admin</SelectItem>
                  <SelectItem value={AdminRole.ADMIN}>Admin</SelectItem>
                  <SelectItem value={AdminRole.VIEWER}>Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={createAdmin.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createAdmin.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Crea
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica amministratore</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome visualizzato</Label>
              <Input {...updateForm.register('displayName')} />
              {updateForm.formState.errors.displayName && (
                <p className="text-xs text-red-500">{updateForm.formState.errors.displayName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...updateForm.register('email')} />
              {updateForm.formState.errors.email && (
                <p className="text-xs text-red-500">{updateForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select
                value={updateForm.watch('role')}
                onValueChange={(v) => updateForm.setValue('role', v as AdminRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AdminRole.SUPER_ADMIN}>Super Admin</SelectItem>
                  <SelectItem value={AdminRole.ADMIN}>Admin</SelectItem>
                  <SelectItem value={AdminRole.VIEWER}>Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="adminActive"
                checked={updateForm.watch('isActive') ?? true}
                onCheckedChange={(v) => updateForm.setValue('isActive', v)}
              />
              <Label htmlFor="adminActive">Account attivo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={updateAdmin.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateAdmin.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salva modifiche
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina amministratore</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo amministratore? L'azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteAdmin.isPending ? (
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
