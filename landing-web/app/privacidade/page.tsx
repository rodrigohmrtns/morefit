import { LegalLayout, legalMetadata } from '@/components/legal-layout';

export const metadata = legalMetadata(
  'Política de Privacidade',
  'Como coletamos, usamos e protegemos seus dados no MoreFit — em conformidade com a LGPD.',
  'privacidade',
);

const UPDATED = '2026-07-23';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade" updated={UPDATED}>
      <p className="lead">
        No MoreFit, sua privacidade é levada a sério. Este documento descreve como coletamos, usamos,
        armazenamos e protegemos seus dados pessoais, sempre em conformidade com a{' '}
        <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD)</strong>.
      </p>

      <h2>1. Quem somos</h2>
      <p>
        <strong>MoreFit Tecnologia Ltda.</strong> (nome fantasia MoreFit), CNPJ nº XX.XXX.XXX/0001-XX,
        com sede em [Endereço], é a controladora dos seus dados pessoais nesta aplicação. Contato:{' '}
        <a href="mailto:contato@morefit.com.br">contato@morefit.com.br</a>.
      </p>

      <h2>2. Encarregado (DPO)</h2>
      <p>
        Nosso Encarregado de Proteção de Dados (DPO) pode ser contactado em{' '}
        <a href="mailto:dpo@morefit.com.br">dpo@morefit.com.br</a> para exercer qualquer um dos seus
        direitos previstos no art. 18 da LGPD.
      </p>

      <h2>3. Dados que coletamos</h2>
      <p>Coletamos apenas os dados estritamente necessários para operar o serviço:</p>
      <ul>
        <li><strong>Dados de cadastro:</strong> nome, e-mail e senha (criptografada com bcrypt).</li>
        <li>
          <strong>Dados de saúde e bem-estar (categoria sensível, art. 5º, II LGPD):</strong> peso,
          altura, medidas corporais, refeições, hidratação, sono, humor, exercícios, jejum, fotos de
          progresso — todos fornecidos voluntariamente por você.
        </li>
        <li><strong>Dados técnicos:</strong> IP, agente do dispositivo, versão do app, logs de acesso.</li>
        <li>
          <strong>Se você usa o Coach IA (plano Premium):</strong> suas mensagens e imagens de refeição
          podem ser processadas por provedores de IA (OpenAI, Google Gemini) para gerar respostas.
          Nunca enviamos identificação pessoal — apenas os dados necessários da conversa.
        </li>
      </ul>

      <h3>3.1 O que NÃO coletamos</h3>
      <ul>
        <li>Localização em tempo real (GPS).</li>
        <li>Contatos, agenda ou histórico do dispositivo.</li>
        <li>Metadados EXIF de fotos (removidos automaticamente no upload).</li>
        <li>Áudio ou vídeo sem sua ação explícita.</li>
      </ul>

      <h2>4. Bases legais (art. 7º e 11 LGPD)</h2>
      <ul>
        <li><strong>Consentimento (art. 7º I):</strong> ao criar sua conta e aceitar esta política.</li>
        <li>
          <strong>Consentimento específico para dados de saúde (art. 11 I):</strong> ao registrar peso,
          medidas, refeições ou fotos você concorda com o tratamento dessa categoria sensível.
        </li>
        <li><strong>Execução de contrato (art. 7º V):</strong> para operar o serviço que você contratou.</li>
        <li>
          <strong>Legítimo interesse (art. 7º IX):</strong> apenas para segurança (prevenção de fraudes,
          detecção de bots).
        </li>
      </ul>

      <h2>5. Como usamos seus dados</h2>
      <ul>
        <li>Prestar o serviço (mostrar seu progresso, gerar insights, sincronizar entre dispositivos).</li>
        <li>Compartilhar relatórios com profissionais (nutricionistas, personais, médicos) — só quando
          você autoriza explicitamente por meio do fluxo de compartilhamento.</li>
        <li>Melhorar o produto (métricas agregadas e anônimas, nunca dados individuais identificáveis).</li>
        <li>Enviar comunicações essenciais (senha, cobrança, mudanças legais).</li>
        <li>
          Enviar novidades/marketing <em>apenas se você deu consentimento específico</em> — revogável a
          qualquer momento em <strong>Perfil → Privacidade</strong>.
        </li>
      </ul>

      <h2>6. Com quem compartilhamos</h2>
      <p>Nossos parceiros processadores (com contratos LGPD-compatíveis):</p>
      <ul>
        <li><strong>MongoDB Atlas</strong> — banco de dados (dados armazenados em datacenters certificados ISO 27001).</li>
        <li><strong>Stripe / Mercado Pago</strong> — processamento de pagamentos (não recebemos números de cartão).</li>
        <li><strong>OpenAI e Google (Gemini)</strong> — IA generativa quando você usa o Coach.</li>
        <li><strong>Sentry / provedor de logs</strong> — observabilidade técnica (dados anonimizados).</li>
      </ul>
      <p>
        <strong>Nunca vendemos seus dados a terceiros.</strong> Nunca autorizamos terceiros a usarem
        seus dados para marketing próprio.
      </p>

      <h2>7. Onde ficam armazenados</h2>
      <p>
        Todos os dados ficam em servidores localizados no Brasil ou, quando isso não é possível, em
        países que garantem grau de proteção equivalente (art. 33 II LGPD). Utilizamos criptografia em
        trânsito (TLS 1.3) e em repouso (AES-256 no MongoDB Atlas).
      </p>

      <h2>8. Quanto tempo guardamos</h2>
      <ul>
        <li>Dados de conta: enquanto sua conta estiver ativa.</li>
        <li>Após exclusão: 30 dias de grace-period (para você recuperar), depois anonimização definitiva.</li>
        <li>Audit logs de segurança: 5 anos (obrigação legal, art. 16 II LGPD).</li>
        <li>Comprovantes fiscais: 5 anos (obrigação tributária).</li>
      </ul>

      <h2>9. Seus direitos (art. 18 LGPD)</h2>
      <p>Você pode a qualquer momento:</p>
      <ul>
        <li><strong>Confirmar</strong> o tratamento dos seus dados.</li>
        <li><strong>Acessar</strong> os dados que temos sobre você.</li>
        <li><strong>Corrigir</strong> dados incompletos, inexatos ou desatualizados.</li>
        <li><strong>Solicitar anonimização, bloqueio ou eliminação</strong> de dados desnecessários.</li>
        <li>
          <strong>Portabilidade</strong> — baixar seus dados em JSON no menu{' '}
          <em>Perfil → Privacidade → Exportar meus dados</em>.
        </li>
        <li>
          <strong>Revogar consentimento</strong> — em <em>Perfil → Privacidade → Comunicações</em> (marketing)
          ou apagando sua conta (dados operacionais).
        </li>
        <li>
          <strong>Informação sobre compartilhamento</strong> — este documento e a página{' '}
          <em>Perfil → Privacidade</em> mostram tudo em tempo real.
        </li>
        <li>
          <strong>Reclamar à ANPD</strong> se não for atendido —{' '}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">gov.br/anpd</a>.
        </li>
      </ul>

      <h2>10. Segurança</h2>
      <ul>
        <li>Senha com hash <em>bcrypt</em> (impossível recuperar em claro).</li>
        <li>Comunicação sempre em HTTPS/TLS 1.3.</li>
        <li>Fotos re-encodadas para remover EXIF/GPS antes do armazenamento.</li>
        <li>Rate limiting, proteção anti brute-force e logs de auditoria.</li>
        <li>Backups criptografados diários.</li>
      </ul>
      <p>
        Mesmo com todas as medidas, nenhum sistema é 100% seguro. Em caso de incidente, notificaremos
        você e a ANPD em prazo compatível com o art. 48 LGPD.
      </p>

      <h2>11. Crianças e adolescentes</h2>
      <p>
        O MoreFit é destinado a maiores de 16 anos. Menores só podem usar com consentimento expresso
        de pais ou responsáveis. Se você é responsável e identificou que seu filho criou conta sem
        autorização, escreva para <a href="mailto:dpo@morefit.com.br">dpo@morefit.com.br</a> que
        removeremos imediatamente.
      </p>

      <h2>12. Cookies</h2>
      <p>
        Nosso site usa cookies estritamente necessários (sessão) e, opcionalmente, cookies de
        performance. Veja mais em <a href="/cookies">Política de Cookies</a>.
      </p>

      <h2>13. Mudanças nesta política</h2>
      <p>
        Podemos atualizar este documento. Mudanças materiais serão comunicadas por e-mail e você será
        solicitado a aceitar novamente na próxima entrada no app. A versão atual e o histórico ficam
        sempre disponíveis nesta página.
      </p>

      <h2>14. Contato</h2>
      <ul>
        <li>Suporte geral: <a href="mailto:suporte@morefit.com.br">suporte@morefit.com.br</a></li>
        <li>DPO: <a href="mailto:dpo@morefit.com.br">dpo@morefit.com.br</a></li>
        <li>Endereço: [Endereço da empresa]</li>
      </ul>

      <hr />
      <p className="text-sm text-ink-muted">
        <em>
          Este documento foi elaborado como <strong>base inicial</strong>. Antes do go-live comercial,
          recomendamos revisão por advogado especialista em LGPD para adequação total ao seu contexto
          específico (setor de saúde, transferência internacional, etc.).
        </em>
      </p>
    </LegalLayout>
  );
}
