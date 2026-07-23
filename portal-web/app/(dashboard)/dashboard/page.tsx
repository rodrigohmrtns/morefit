'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { listSharedPatients } from '@/lib/api';

export default function DashboardHome() {
  const { data, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => listSharedPatients().catch(() => ({ items: [] })),
  });

  const patients = data?.items ?? [];
  const totalPatients = patients.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-ink-muted">Resumo dos seus pacientes e atividade recente.</p>
        </div>
        <Link href="/patients" className="btn-primary">
          <Users size={18} /> Ver pacientes
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Pacientes ativos" value={isLoading ? '…' : String(totalPatients)} accent="brand" />
        <StatCard icon={TrendingUp} label="Aderência semanal" value="—" hint="Aguardando dados" />
        <StatCard icon={FileText} label="Relatórios este mês" value="—" hint="Aguardando dados" />
        <StatCard icon={Sparkles} label="Insights de IA" value="Em breve" hint="Novidade Q3/2026" />
      </div>

      {/* Recent patients */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Pacientes recentes</h2>
          <Link href="/patients" className="text-sm text-brand-dark font-semibold hover:underline">
            Ver todos →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-ink/10 rounded w-1/3" />
                <div className="mt-2 h-3 bg-ink/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <EmptyPatients />
        ) : (
          <div className="space-y-3">
            {patients.slice(0, 5).map((p) => (
              <Link key={p.user_id} href={`/patient/${p.user_id}`} className="card block hover:scale-[1.005] transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-ink-muted">{p.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-ink-muted">
                      {p.weight_kg ? `${p.weight_kg} kg` : '—'}
                    </div>
                    <div className="text-xs text-ink-muted">
                      Vinculado em {new Date(p.shared_at).toLocaleDateString('pt-BR')}
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

function StatCard({ icon: Icon, label, value, hint, accent }: any) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${accent === 'brand' ? 'bg-brand text-brand-fg' : 'bg-surface-tertiary text-ink'}`}>
          <Icon size={20} />
        </div>
        <div className="text-sm text-ink-muted">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

function EmptyPatients() {
  return (
    <div className="card text-center py-12">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-tint">
        <Users size={28} className="text-brand-dark" />
      </div>
      <h3 className="mt-4 text-xl font-bold">Nenhum paciente vinculado ainda</h3>
      <p className="mt-2 text-ink-muted max-w-md mx-auto">
        Peça aos seus pacientes que compartilhem o relatório MoreFit com seu e-mail profissional.
        Eles aparecerão aqui automaticamente.
      </p>
      <a href="https://www.morefit.com.br/blog/como-vincular-pacientes" className="btn-ghost mt-6">
        Como funciona
      </a>
    </div>
  );
}
