import Link from 'next/link';
import {
  Sparkles,
  Utensils,
  Activity,
  Moon,
  Droplets,
  Camera,
  Trophy,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
} from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Plans />
      <Testimonials />
      <FAQ />
      <DownloadCTA />
    </>
  );
}

// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-24">
      <div aria-hidden className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand/40 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-tint blur-3xl" />
      <div className="container-mf relative grid gap-10 md:grid-cols-2 md:items-center">
        <div className="animate-fadeUp">
          <span className="inline-block rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">
            Saúde inteligente
          </span>
          <h1 className="mt-4 text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Sua jornada de{' '}
            <span className="relative inline-block">
              saúde
              <svg viewBox="0 0 200 12" className="absolute -bottom-2 left-0 w-full" preserveAspectRatio="none">
                <path d="M2 8 C 60 -2, 140 -2, 198 6" stroke="#C6F14B" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>{' '}
            começa aqui.
          </h1>
          <p className="mt-5 text-lg text-ink-soft max-w-lg">
            Peso, nutrição, exercícios, sono e bem-estar em um só app — com IA que entende sua rotina e te acompanha
            todo dia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#download" className="btn-primary">
              <Sparkles size={18} /> Baixar grátis
            </Link>
            <Link href="#features" className="btn-ghost">
              Ver recursos <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-ink-muted">
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-surface bg-gradient-to-br from-brand to-brand-tint" />
              ))}
            </div>
            <span>+10 mil usuários • 4,8 ★ em avaliações</span>
          </div>
        </div>

        <div className="relative animate-fadeUp [animation-delay:150ms]">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-64 md:w-72">
      <div className="rounded-[3rem] border-[10px] border-ink bg-surface-strong p-4 shadow-2xl">
        <div className="rounded-[2rem] bg-surface-strong overflow-hidden">
          <div className="p-5 space-y-4 text-surface-onStrong">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-brand">Bom dia, Ana</div>
                <div className="text-xl font-bold">Quarta, 22 de julho</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-brand grid place-items-center text-brand-fg font-bold">A</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs opacity-70">Peso atual</div>
              <div className="text-3xl font-bold mt-1">75,0 <span className="text-lg text-brand">kg</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div className="h-full w-3/5 rounded-full bg-brand" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: 'Água', v: '1,2L', c: 'bg-brand-tint text-brand-dark' },
                { l: 'Kcal', v: '1420', c: 'bg-white/10' },
                { l: 'Passos', v: '6.8k', c: 'bg-white/10' },
              ].map((s) => (
                <div key={s.l} className={`rounded-xl p-3 ${s.c}`}>
                  <div className="text-[10px] opacity-70">{s.l}</div>
                  <div className="font-bold text-sm mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-brand p-4 text-brand-fg">
              <div className="text-xs font-bold">✨ Coach IA</div>
              <div className="mt-1 text-sm font-semibold leading-tight">Boa! Você está 90% da meta de proteína.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function TrustBar() {
  return (
    <section className="border-y border-ink/5 bg-surface-soft">
      <div className="container-mf py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-ink-muted">
        <span className="font-semibold">Aparecemos em:</span>
        <span>Exame</span>
        <span>GaúchaZH</span>
        <span>UOL Vida & Saúde</span>
        <span>Terra</span>
        <span>Metrópoles</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
const FEATURES = [
  { icon: Utensils, title: 'Diário alimentar com IA', body: 'Escaneie sua refeição com a câmera. A IA calcula calorias e macros em segundos.' },
  { icon: Activity, title: 'Peso & composição', body: 'Acompanhe peso, IMC, gordura, massa magra e 14 medidas corporais em gráficos suaves.' },
  { icon: Droplets, title: 'Hidratação', body: 'Metas diárias, lembretes inteligentes e histórico visual da sua ingestão.' },
  { icon: Moon, title: 'Sono & humor', body: 'Registre horas, qualidade e correlacione com energia, alimentação e treinos.' },
  { icon: Camera, title: 'Fotos de progresso', body: 'Compare mês a mês numa timeline privada, com criptografia local.' },
  { icon: Sparkles, title: 'Coach virtual 24/7', body: 'Chat com IA especializada em nutrição, treino e motivação — plano Premium.' },
  { icon: Trophy, title: 'Gamificação', body: 'Streaks, conquistas e ranking com amigos para você não parar no meio.' },
  { icon: Users, title: 'Comunidade & compartilhamento', body: 'Envie relatórios em PDF para seu nutri ou personal com 1 clique.' },
];

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="container-mf">
        <div className="max-w-2xl">
          <span className="rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">Recursos</span>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            Tudo o que você precisa para <em className="not-italic text-brand-dark">sentir progresso</em>.
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Um app minimalista, pensado no toque com uma mão — sem planilhas, sem complicação.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card hover:scale-[1.02] transition">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-fg">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function HowItWorks() {
  const steps = [
    { n: '01', title: 'Baixe grátis', body: 'Disponível na App Store e Google Play. Cadastro em 30 segundos.' },
    { n: '02', title: 'Defina sua meta', body: 'Perder peso, ganhar massa ou manter saúde — o app se adapta.' },
    { n: '03', title: 'Registre no automático', body: 'IA identifica refeições por foto. Wearables sincronizam sono e passos.' },
    { n: '04', title: 'Evolua com clareza', body: 'Gráficos, insights e Coach IA guiam sua semana.' },
  ];
  return (
    <section className="py-24 bg-surface-strong text-surface-onStrong">
      <div className="container-mf">
        <div className="max-w-2xl">
          <span className="rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">Como funciona</span>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-white">
            4 passos. Zero atrito.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl bg-white/5 p-6 border border-white/10">
              <div className="text-brand text-sm font-bold">{s.n}</div>
              <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm opacity-70">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
const PLANS = [
  {
    name: 'Free',
    price: 'R$ 0',
    period: '/mês',
    cta: 'Começar grátis',
    highlight: false,
    features: [
      'Diário alimentar básico',
      'Peso + IMC + medidas',
      'Água e passos',
      'Metas diárias',
      'Fotos de progresso',
      'Comunidade',
    ],
  },
  {
    name: 'Premium',
    price: 'R$ 19,90',
    period: '/mês',
    cta: 'Assinar Premium',
    highlight: true,
    features: [
      'Tudo do Free',
      'Coach IA 24/7 no chat',
      'Scan de refeições por câmera',
      'Receitas personalizadas por IA',
      'Relatórios em PDF (nutri/personal/médico)',
      'Predição 30d e insights avançados',
      'Sem anúncios',
    ],
  },
  {
    name: 'Empresarial',
    price: 'Sob consulta',
    period: '',
    cta: 'Falar com vendas',
    highlight: false,
    features: [
      'Portal corporativo',
      'Campanhas & rankings internos',
      'Dashboard agregado (LGPD-safe)',
      'SLA dedicado',
      'Onboarding personalizado',
    ],
  },
];

function Plans() {
  return (
    <section id="planos" className="py-24">
      <div className="container-mf">
        <div className="text-center max-w-2xl mx-auto">
          <span className="rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">Planos</span>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            Comece grátis. Evolua quando quiser.
          </h2>
          <p className="mt-4 text-lg text-ink-soft">Cancele a qualquer momento. Sem letras miúdas.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`card relative ${p.highlight ? 'ring-2 ring-brand shadow-xl scale-[1.02]' : ''}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-brand px-3 py-1 text-xs font-bold text-brand-fg">
                  Mais popular
                </span>
              )}
              <h3 className="text-2xl font-bold">{p.name}</h3>
              <div className="mt-2">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-ink-muted text-sm">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 text-brand-dark" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.name === 'Empresarial' ? '/contato' : '#download'}
                className={`mt-8 block text-center ${p.highlight ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function Testimonials() {
  const items = [
    { n: 'Maria S.', role: 'Perdeu 12kg em 5 meses', q: 'O MoreFit foi o primeiro app que consegui usar todo dia. A IA de refeições mudou tudo.' },
    { n: 'Dr. Rafael', role: 'Nutricionista', q: 'Os relatórios em PDF economizam horas por semana. Meus pacientes adoram o app.' },
    { n: 'Bruno L.', role: 'Personal trainer', q: 'Gamificação e comunidade fazem meus alunos se manterem consistentes.' },
  ];
  return (
    <section className="py-24 bg-brand-tint">
      <div className="container-mf">
        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-brand-dark">
            Quem usa, ama.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <blockquote key={t.n} className="rounded-3xl bg-white p-6 border border-brand-dark/10">
              <p className="text-lg italic leading-relaxed">"{t.q}"</p>
              <footer className="mt-4 text-sm">
                <strong className="text-brand-dark">{t.n}</strong>
                <span className="text-ink-muted"> • {t.role}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function FAQ() {
  const qs = [
    { q: 'O MoreFit é gratuito?', a: 'Sim, o plano Free é gratuito para sempre. Recursos avançados (Coach IA, scan por câmera, PDF profissional) estão no Premium.' },
    { q: 'Meus dados são privados?', a: 'Sim. Somos LGPD-first: você exporta ou deleta seus dados a qualquer momento. Nada é vendido a terceiros.' },
    { q: 'Funciona sem internet?', a: 'Sim. Registros feitos offline sincronizam automaticamente assim que você volta a ficar online.' },
    { q: 'Posso cancelar quando quiser?', a: 'Sim, sem multa. Você mantém o acesso até o fim do período pago.' },
    { q: 'Integra com Apple Health / Google Fit?', a: 'Sim. Puxamos passos, sono, batimentos e energia ativa automaticamente.' },
  ];
  return (
    <section id="faq" className="py-24">
      <div className="container-mf max-w-3xl">
        <div className="text-center">
          <span className="rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">FAQ</span>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            Perguntas frequentes
          </h2>
        </div>
        <div className="mt-12 space-y-3">
          {qs.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-ink/10 bg-surface-soft p-5 open:shadow">
              <summary className="cursor-pointer font-semibold flex items-center justify-between">
                {item.q}
                <span className="text-brand-dark transition group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-ink-soft leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function DownloadCTA() {
  return (
    <section id="download" className="py-24">
      <div className="container-mf">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-surface-strong text-surface-onStrong p-10 md:p-16">
          <div aria-hidden className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <ShieldCheck className="text-brand mb-4" size={32} />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Baixe grátis e comece hoje.</h2>
            <p className="mt-4 text-lg opacity-80">
              iOS, Android e web. Sincronização em nuvem, LGPD-first e sem anúncios no plano Free.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="https://apps.apple.com/app/morefit" className="btn-primary">
                 Baixar para iOS
              </a>
              <a href="https://play.google.com/store/apps/morefit" className="btn-ghost bg-white text-ink">
                ▶ Baixar para Android
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
