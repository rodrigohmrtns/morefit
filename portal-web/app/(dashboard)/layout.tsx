'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { logout as apiLogout, me, type User } from '@/lib/api';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/patients', label: 'Pacientes', icon: Users },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    me()
      .then(setUser)
      .catch(() => router.replace('/login'));
  }, [router]);

  const logout = async () => {
    try { await apiLogout(); } catch { /* still redirect */ }
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        className="md:hidden fixed top-4 left-4 z-40 h-11 w-11 rounded-full bg-surface-soft border border-ink/10 grid place-items-center shadow"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-30 w-64 bg-surface-strong text-surface-onStrong p-6 flex flex-col transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg mb-10" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-brand-fg">✦</span>
          <span>MoreFit <span className="text-brand text-sm font-semibold">Pro</span></span>
        </Link>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition',
                  active
                    ? 'bg-brand text-brand-fg'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="mt-auto pt-6 border-t border-white/10">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand grid place-items-center text-brand-fg font-bold">
                {user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{user.name}</div>
                <div className="text-xs text-white/50 truncate">{user.email}</div>
              </div>
              <button
                onClick={logout}
                aria-label="Sair"
                className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="text-xs text-white/50">Carregando…</div>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 md:ml-0 p-6 md:p-10 max-w-full">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
