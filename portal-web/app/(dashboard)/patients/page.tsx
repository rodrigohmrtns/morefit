'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { listSharedPatients } from '@/lib/api';

export default function PatientsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => listSharedPatients().catch(() => ({ items: [] })),
  });
  const [q, setQ] = useState('');

  const filtered = (data?.items ?? []).filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
      <p className="mt-1 text-ink-muted">Todos os pacientes que compartilharam relatórios com você.</p>

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="input pl-10"
        />
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-ink/10 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Users size={40} className="mx-auto text-ink-muted" />
            <p className="mt-3 text-ink-muted">
              {q ? 'Nenhum paciente encontrado.' : 'Nenhum paciente vinculado ainda.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => (
              <Link key={p.user_id} href={`/patient/${p.user_id}`} className="card block hover:scale-[1.005] transition">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-brand-tint grid place-items-center text-brand-dark font-bold text-lg">
                    {p.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-sm text-ink-muted truncate">{p.email}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{p.weight_kg ? `${p.weight_kg} kg` : '—'}</div>
                    <div className="text-xs text-ink-muted">
                      {new Date(p.shared_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
