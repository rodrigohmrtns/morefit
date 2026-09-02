import { LegalLayout, legalMetadata } from '@/components/legal-layout';

export const metadata = legalMetadata(
  'Política de Cookies',
  'Como o MoreFit usa cookies e tecnologias similares.',
  'cookies',
);

const UPDATED = '2026-07-23';

export default function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies" updated={UPDATED}>
      <p className="lead">
        Esta página explica o que são cookies, quais usamos no MoreFit e como você pode gerenciá-los.
      </p>

      <h2>1. O que são cookies?</h2>
      <p>
        Cookies são pequenos arquivos de texto que sites armazenam no seu navegador para lembrar
        preferências, manter você logado ou medir uso. Este site usa também tecnologias similares
        como <em>localStorage</em> e <em>sessionStorage</em>.
      </p>

      <h2>2. Cookies que usamos</h2>

      <h3>2.1 Estritamente necessários (sempre ativos)</h3>
      <p>Não requerem consentimento — sem eles o site não funciona.</p>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="text-left border-b border-ink/10">
              <th className="py-2 pr-4">Nome</th>
              <th className="py-2 pr-4">Origem</th>
              <th className="py-2 pr-4">Finalidade</th>
              <th className="py-2">Retenção</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            <tr className="border-b border-ink/5">
              <td className="py-2 pr-4 font-mono">mf_portal_session</td>
              <td className="py-2 pr-4">app.morefit.com.br</td>
              <td className="py-2 pr-4">Sessão autenticada no portal profissional (HttpOnly, Secure)</td>
              <td className="py-2">30 dias</td>
            </tr>
            <tr className="border-b border-ink/5">
              <td className="py-2 pr-4 font-mono">__cf_bm</td>
              <td className="py-2 pr-4">Cloudflare</td>
              <td className="py-2 pr-4">Proteção anti-bot</td>
              <td className="py-2">30 minutos</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>2.2 Performance & analytics (opcionais)</h3>
      <p>Só são ativados se você aceitar no banner de cookies. Servem para entender de forma
        agregada como o site é usado e melhorá-lo.</p>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="text-left border-b border-ink/10">
              <th className="py-2 pr-4">Nome</th>
              <th className="py-2 pr-4">Origem</th>
              <th className="py-2 pr-4">Finalidade</th>
              <th className="py-2">Retenção</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            <tr className="border-b border-ink/5">
              <td className="py-2 pr-4 font-mono">_ga, _ga_*</td>
              <td className="py-2 pr-4">Google Analytics</td>
              <td className="py-2 pr-4">Métricas anônimas de navegação</td>
              <td className="py-2">até 2 anos</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>2.3 Marketing</h3>
      <p>
        <strong>Não utilizamos</strong> cookies de terceiros para publicidade direcionada ou
        remarketing neste momento.
      </p>

      <h2>3. Como controlar</h2>
      <ul>
        <li>
          <strong>No banner de cookies</strong> na primeira visita, você pode aceitar todos, apenas
          os essenciais ou personalizar por categoria.
        </li>
        <li>
          <strong>No seu navegador:</strong> configurações → privacidade → limpar cookies. Isso
          removerá também sua sessão de login.
        </li>
        <li>
          <strong>No app mobile:</strong> não usamos cookies no aplicativo nativo. A sessão é
          gerenciada por token JWT em armazenamento seguro do sistema operacional.
        </li>
      </ul>

      <h2>4. Cookies e a LGPD</h2>
      <p>
        Cookies estritamente necessários são tratados sob a base legal de <em>legítimo interesse</em>{' '}
        (art. 7º IX LGPD). Cookies de performance e marketing só são utilizados com{' '}
        <strong>consentimento explícito</strong> (art. 7º I). Você pode revogar o consentimento a
        qualquer momento acessando esta página e clicando em "Rever preferências".
      </p>

      <h2>5. Contato</h2>
      <p>
        Dúvidas sobre esta política? Escreva para{' '}
        <a href="mailto:dpo@morefit.com.br">dpo@morefit.com.br</a>.
      </p>

      <hr />
      <p className="text-sm text-ink-muted">
        <em>
          Base inicial. Ajustaremos conforme os provedores de analytics forem sendo integrados.
        </em>
      </p>
    </LegalLayout>
  );
}
