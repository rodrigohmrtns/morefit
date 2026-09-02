import { LegalLayout, legalMetadata } from '@/components/legal-layout';

export const metadata = legalMetadata(
  'Termos de Uso',
  'Regras para uso do MoreFit — aplicativo e serviços.',
  'termos',
);

const UPDATED = '2026-07-23';

export default function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso" updated={UPDATED}>
      <p className="lead">
        Estes Termos regem o uso do aplicativo MoreFit (iOS, Android, web) e serviços associados
        (portal profissional, site institucional). Ao criar uma conta, você declara que leu, entendeu
        e concorda com todos os itens abaixo.
      </p>

      <h2>1. Definições</h2>
      <ul>
        <li><strong>MoreFit</strong> ou <strong>Serviço</strong>: aplicativo, portal, site e APIs operados pela MoreFit Tecnologia Ltda.</li>
        <li><strong>Usuário</strong>: pessoa física maior de 16 anos que cria conta no Serviço.</li>
        <li><strong>Profissional</strong>: nutricionista, personal trainer ou médico com CRN/CREF/CRM ativo, cadastrado por parceria com o MoreFit.</li>
        <li><strong>Conteúdo do Usuário</strong>: qualquer dado que você registra (peso, refeições, fotos etc.).</li>
      </ul>

      <h2>2. Aceite dos Termos</h2>
      <p>
        Você aceita estes Termos ao marcar a caixa "Li e aceito os Termos e a Política de Privacidade"
        no cadastro. Se não concorda, não use o Serviço. Podemos atualizar os Termos; mudanças
        materiais serão comunicadas com pelo menos 30 dias de antecedência.
      </p>

      <h2>3. Conta e acesso</h2>
      <ul>
        <li>Você é responsável por manter sua senha segura e por tudo que ocorrer sob sua conta.</li>
        <li>Uma conta por pessoa. É proibido compartilhar credenciais.</li>
        <li>Menores de 16 anos precisam de autorização dos pais/responsáveis.</li>
        <li>Podemos suspender contas que violem estes Termos, sem aviso prévio quando houver risco iminente.</li>
      </ul>

      <h2>4. Planos e pagamentos</h2>
      <ul>
        <li>O plano Free é gratuito e sem prazo de expiração.</li>
        <li>O plano Premium é uma assinatura recorrente cobrada por Stripe ou Mercado Pago.</li>
        <li>Cancelamento a qualquer momento — acesso mantido até o fim do período pago.</li>
        <li>Reembolso proporcional em até 7 dias após a assinatura (Código de Defesa do Consumidor, art. 49).</li>
        <li>Preços podem mudar com 30 dias de aviso; se você não aceitar, pode cancelar sem cobrança adicional.</li>
      </ul>

      <h2>5. Uso do Serviço</h2>
      <p>Você concorda em NÃO:</p>
      <ul>
        <li>Usar o Serviço para fins ilegais ou de forma que viole direitos de terceiros.</li>
        <li>Aplicar engenharia reversa, extrair código ou copiar o design.</li>
        <li>Enviar conteúdo ofensivo, difamatório, discriminatório ou que promova auto-lesão.</li>
        <li>Automatizar o uso (bots, scrapers) sem autorização escrita.</li>
        <li>Compartilhar dados de outros usuários ou de profissionais sem consentimento.</li>
      </ul>

      <h2>6. Conteúdo do Usuário</h2>
      <p>
        Você mantém todos os direitos sobre seus dados. Ao usar o Serviço, você nos concede uma
        licença limitada, não-exclusiva e revogável para armazenar, processar e apresentar seu
        conteúdo apenas para operar o Serviço para você (e, quando você autoriza, para o
        profissional que vinculou).
      </p>

      <h2>7. Aviso sobre saúde ⚠️</h2>
      <p className="rounded-2xl bg-brand-tint p-4 border-l-4 border-brand-dark">
        <strong>O MoreFit NÃO substitui aconselhamento médico, nutricional ou de treinamento
        profissional.</strong> Cálculos de calorias, previsões de peso e sugestões da IA são
        estimativas educacionais. Sempre consulte um profissional habilitado antes de mudanças
        significativas em dieta, exercícios ou medicação — especialmente se você tem alguma
        condição de saúde, está grávida ou toma medicamentos.
      </p>

      <h2>8. IA e limitações</h2>
      <ul>
        <li>O Coach IA usa modelos de terceiros (OpenAI, Google Gemini) e pode gerar respostas incorretas.</li>
        <li>Não use respostas da IA como diagnóstico ou prescrição.</li>
        <li>Não confie 100% no scan de refeição por câmera — a margem de erro é de ~10-20%.</li>
        <li>Reservamo-nos o direito de auditar / bloquear uso abusivo do Coach.</li>
      </ul>

      <h2>9. Propriedade intelectual</h2>
      <p>
        Todo o código, design, marca, textos e ilustrações do MoreFit são de propriedade exclusiva
        da MoreFit Tecnologia Ltda. e protegidos pelas leis de propriedade intelectual do Brasil e
        internacionais.
      </p>

      <h2>10. Portal Profissional</h2>
      <ul>
        <li>Somente profissionais com CRN/CREF/CRM ativo, verificados pelo MoreFit, têm acesso.</li>
        <li>O profissional só vê pacientes que compartilharam voluntariamente com o e-mail cadastrado.</li>
        <li>É proibido usar os dados de pacientes para qualquer fim que não seja o acompanhamento acordado.</li>
        <li>Descumprimento resulta em bloqueio imediato e, quando cabível, notificação ao conselho profissional.</li>
      </ul>

      <h2>11. Disponibilidade</h2>
      <p>
        Buscamos SLA de 99,5% mas não garantimos disponibilidade ininterrupta. Manutenções
        programadas serão avisadas com pelo menos 24h de antecedência (exceto emergenciais).
      </p>

      <h2>12. Limitação de responsabilidade</h2>
      <p>
        Na medida máxima permitida por lei, o MoreFit não se responsabiliza por (a) danos
        indiretos, lucros cessantes ou perda de dados fora do backup padrão; (b) decisões de saúde
        tomadas com base no app; (c) falhas em serviços de terceiros (Stripe, provedores de IA, etc.).
        Nossa responsabilidade agregada, quando cabível, fica limitada ao valor pago pelo usuário nos
        12 meses anteriores ao evento.
      </p>

      <h2>13. Encerramento</h2>
      <ul>
        <li>Você pode deletar sua conta a qualquer momento em <em>Perfil → Privacidade</em>.</li>
        <li>Podemos encerrar contas que violem estes Termos, precedido de aviso quando possível.</li>
        <li>Após encerramento: 30 dias para recuperação, depois anonimização.</li>
      </ul>

      <h2>14. Foro e legislação</h2>
      <p>
        Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca da sede da
        MoreFit Tecnologia Ltda. para dirimir qualquer controvérsia, com renúncia expressa a
        qualquer outro por mais privilegiado que seja.
      </p>

      <h2>15. Contato</h2>
      <ul>
        <li>Suporte: <a href="mailto:suporte@morefit.com.br">suporte@morefit.com.br</a></li>
        <li>Comercial: <a href="mailto:contato@morefit.com.br">contato@morefit.com.br</a></li>
        <li>Legal / DPO: <a href="mailto:dpo@morefit.com.br">dpo@morefit.com.br</a></li>
      </ul>

      <hr />
      <p className="text-sm text-ink-muted">
        <em>
          Documento base inicial. Recomenda-se revisão por advogado especialista antes do go-live
          comercial para adequação ao contexto específico e riscos setoriais.
        </em>
      </p>
    </LegalLayout>
  );
}
