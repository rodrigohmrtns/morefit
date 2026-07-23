export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
      <p className="mt-1 text-ink-muted">Baixe relatórios agregados dos seus pacientes.</p>

      <div className="mt-8 card text-center py-16">
        <div className="text-5xl">📊</div>
        <h2 className="mt-4 text-xl font-bold">Em breve</h2>
        <p className="mt-2 text-ink-muted max-w-md mx-auto">
          Estamos preparando relatórios agregados (adesão, evolução média, alertas de risco) para você.
          Enquanto isso, baixe o PDF individual de cada paciente na aba <strong>Pacientes</strong>.
        </p>
      </div>
    </div>
  );
}
