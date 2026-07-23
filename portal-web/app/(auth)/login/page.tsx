'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail, LogIn, AlertCircle } from 'lucide-react';
import { login, me, setToken } from '@/lib/api';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha muito curta'),
});
type FormData = z.infer<typeof schema>;

const PROFESSIONAL_ROLES = new Set(['nutritionist', 'personal', 'doctor', 'admin']);

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-ink-muted">Carregando…</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get('from') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const res = await login(data.email, data.password);
      setToken(res.token);
      // Verify role — portal requires a professional role
      const profile = res.user.role ? res.user : await me();
      if (!profile.role || !PROFESSIONAL_ROLES.has(profile.role)) {
        setError('Sua conta não tem acesso ao portal profissional. Fale com o suporte.');
        return;
      }
      router.replace(redirectTo);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Falha no login';
      setError(typeof msg === 'string' ? msg : 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left panel — brand */}
      <div className="hidden md:flex bg-surface-strong text-surface-onStrong p-12 flex-col justify-between">
        <div className="flex items-center gap-2 font-bold text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-fg">✦</span>
          MoreFit <span className="text-brand ml-1 text-sm font-semibold">Pro</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Acompanhe seus pacientes.<br />
            Onde quer que você esteja.
          </h1>
          <p className="mt-4 text-lg opacity-70 max-w-md">
            Painel exclusivo para nutricionistas, personais e médicos parceiros MoreFit.
          </p>
        </div>
        <p className="text-sm opacity-50">© {new Date().getFullYear()} MoreFit • morefit.com.br</p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 font-bold md:hidden mb-8">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-brand-fg">✦</span>
            MoreFit Pro
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Entrar no portal</h2>
          <p className="mt-2 text-ink-muted">Use o mesmo e-mail e senha do app MoreFit.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            <div>
              <label className="text-sm font-semibold text-ink">E-mail</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  className="input pl-10"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-state-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-ink">Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input pl-10"
                />
              </div>
              {errors.password && <p className="mt-1 text-sm text-state-error">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-xl bg-state-error/10 border border-state-error/30 p-3 flex items-start gap-2">
                <AlertCircle className="text-state-error mt-0.5" size={18} />
                <p className="text-sm text-state-error">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              <LogIn size={18} />
              {loading ? 'Entrando…' : 'Entrar'}
            </button>

            <div className="text-center text-sm text-ink-muted mt-6">
              Ainda não é parceiro?{' '}
              <a href="https://www.morefit.com.br/contato" className="text-brand-dark font-semibold hover:underline">
                Fale com a gente
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
