'use client';

import { useEffect, useState } from 'react';
import { me, type User } from '@/lib/api';

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    me().then(setUser).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      <p className="mt-1 text-ink-muted">Perfil, notificações e integrações.</p>

      <div className="mt-8 space-y-4">
        <div className="card">
          <h2 className="text-lg font-bold">Perfil profissional</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <Field label="Nome" value={user?.name ?? '—'} />
            <Field label="E-mail" value={user?.email ?? '—'} />
            <Field label="Função" value={user?.role ?? '—'} />
            <Field label="ID" value={user?.user_id ?? '—'} mono />
          </div>
          <p className="mt-6 text-xs text-ink-muted">
            Para alterar dados do perfil, acesse o app MoreFit ou fale com o suporte em{' '}
            <a href="mailto:suporte@morefit.com.br" className="text-brand-dark font-semibold">suporte@morefit.com.br</a>.
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold">Notificações</h2>
          <p className="mt-2 text-ink-muted text-sm">
            E-mail quando novo paciente compartilhar relatório. <span className="badge bg-brand-tint text-brand-dark ml-2">Em breve</span>
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold">Segurança</h2>
          <p className="mt-2 text-ink-muted text-sm">
            Sessão JWT com expiração em 30 dias. Ao trocar de dispositivo, faça logout aqui.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-1 font-semibold ${mono ? 'font-mono text-sm' : ''}`}>{value}</div>
    </div>
  );
}
