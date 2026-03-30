'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Users, Trophy, Star,
  MessageSquare, Settings, ScrollText, Shield, BarChart3, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLogout } from '@/hooks/use-auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/submissions', label: 'Segnalazioni', icon: FileText },
  { href: '/referrers', label: 'Referenti', icon: Users },
  { href: '/leaderboard', label: 'Classifica', icon: Trophy },
  { href: '/score-rules', label: 'Regole Punteggio', icon: Star },
  { href: '/bot-messages', label: 'Messaggi Bot', icon: MessageSquare },
  { href: '/settings', label: 'Impostazioni', icon: Settings },
  { href: '/audit-logs', label: 'Audit Log', icon: ScrollText },
  { href: '/admins', label: 'Amministratori', icon: Shield },
];

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-800 px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <p className="text-sm font-semibold text-white truncate">RefTrack</p>
            <p className="text-xs text-slate-500">Pannello Admin</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-800 p-2">
        <button
          onClick={() => logout.mutate()}
          title={collapsed ? 'Esci' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg px-2 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Esci</span>}
        </button>
      </div>
    </aside>
  );
}
