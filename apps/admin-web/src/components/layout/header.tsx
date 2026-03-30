'use client';
import { Bell, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useAuth, useLogout } from '@/hooks/use-auth';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/submissions': 'Segnalazioni',
  '/referrers': 'Referenti',
  '/leaderboard': 'Classifica',
  '/score-rules': 'Regole Punteggio',
  '/bot-messages': 'Messaggi Bot',
  '/settings': 'Impostazioni',
  '/audit-logs': 'Audit Log',
  '/admins': 'Amministratori',
};

interface HeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Header({ collapsed, onToggle }: HeaderProps) {
  const pathname = usePathname();
  const { admin } = useAuth();
  const logout = useLogout();

  const title = pageTitles[pathname] ?? pageTitles[`/${pathname.split('/')[1]}`] ?? 'Admin';
  const initials = admin?.displayName
    ? admin.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          title={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Bell className="h-5 w-5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">{admin?.displayName ?? 'Admin'}</p>
                <p className="text-xs text-slate-500">{admin?.role ?? ''}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-slate-600 text-sm">
              {admin?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout.mutate()}
              className="text-red-600 cursor-pointer"
            >
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
