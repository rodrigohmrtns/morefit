'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { getPatientSummary, API_URL } from '@/lib/api';

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['patient', params.id],
    queryFn: () => getPatientSummary(params.id),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-ink/10 rounded animate-pulse w-1/3" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="card text-center py-12">
        <p className="text-ink-muted">Não foi possível carregar os dados deste paciente.</p>
        <Link href="/patients" className="btn-ghost mt-4 inline-flex">← Voltar</Link>
      </div>
    );
  }

  const weightSeries = data.weights.slice().reverse().map((w) => ({
    date: w.date.slice(5),
    weight: w.weight_kg,
  }));

  const latestBmi =
    data.user.height_cm && data.weights[0]
      ? +(data.weights[0].weight_kg / Math.pow(data.user.height_cm / 100, 2)).toFixed(1)
      : null;

  return (
    <div>
      <Link href="/patients" className="text-sm text-ink-muted hover:text-brand-dark inline-flex items-center gap-1">
        <ArrowLeft size={16} /> Todos os pacientes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.user.name}</h1>
          <p className="mt-1 text-ink-muted">{data.user.email}</p>
        </div>
        <a
          href={`${API_URL}/api/professionals/patients/${params.id}/pdf?type=all`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
        >
          <Download size={16} /> Baixar PDF completo
        </a>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Peso atual" value={data.weights[0]?.weight_kg ? `${data.weights[0].weight_kg} kg` : '—'} />
        <Stat label="Altura" value={data.user.height_cm ? `${data.user.height_cm} cm` : '—'} />
        <Stat label="IMC" value={latestBmi ? String(latestBmi) : '—'} />
        <Stat label="Meta" value={data.user.goal || '—'} />
      </div>

      {/* Weight chart */}
      <div className="card mt-8">
        <h2 className="text-lg font-bold">Evolução do peso</h2>
        {weightSeries.length < 2 ? (
          <p className="mt-4 text-ink-muted text-sm">Poucos dados para exibir o gráfico.</p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEC" />
                <XAxis dataKey="date" stroke="#83877F" fontSize={12} />
                <YAxis stroke="#83877F" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #EDEFEC' }}
                  labelStyle={{ color: '#0F1110' }}
                />
                <Line type="monotone" dataKey="weight" stroke="#26301A" strokeWidth={3} dot={{ fill: '#C6F14B' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent activity tables */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <RecentTable
          title="Últimas refeições"
          columns={['Data', 'Refeição', 'Kcal']}
          rows={data.meals.slice(0, 8).map((m) => [m.date, m.name, `${Math.round(m.calories)}`])}
        />
        <RecentTable
          title="Últimos exercícios"
          columns={['Data', 'Exercício', 'Min', 'Kcal']}
          rows={data.exercises.slice(0, 8).map((e) => [e.date, e.name, `${e.duration_min}`, `${e.calories_burned}`])}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function RecentTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="card">
      <h3 className="text-lg font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-ink-muted text-sm">Sem registros ainda.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted text-xs uppercase tracking-wider">
              {columns.map((c) => (
                <th key={c} className="py-2 border-b border-ink/5">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ink/5 last:border-0">
                {r.map((cell, j) => (
                  <td key={j} className="py-2 pr-2">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
