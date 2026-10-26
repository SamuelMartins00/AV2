import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

const TAGS: Record<string, string> = {
  auth: "Autenticação",
  auditoria: "Auditoria",
  organizacoes: "Organizações e contratos",
  lotes: "Lotes",
  equipamentos: "Equipamentos",
  relatorios: "Relatórios",
  configuracao: "Configuração",
  usuarios: "Usuários",
  saude: "Sistema",
};

// Resumo de cada rota, com os papéis que podem usá-la
const RESUMOS: Record<string, string> = {
  "POST /api/v1/auth/login": "Autentica e devolve o access token e o refresh token",
  "POST /api/v1/auth/refresh": "Troca o refresh token por um novo par de tokens",
  "POST /api/v1/auth/logout": "Revoga o refresh token (encerra a sessão)",
  "POST /api/v1/auth/alterar-senha": "Altera a própria senha (revoga as sessões)",
  "GET /api/v1/auth/me": "Dados do usuário autenticado",

  "GET /api/v1/auditoria/journal": "Consulta paginada e somente de leitura do journal (administrador, auditor)",

  "POST /api/v1/organizacoes": "Cadastra organização, com contrato opcional (administrador, operador)",
  "GET /api/v1/organizacoes": "Lista organizações paginadas com filtros de razão social, CNPJ e status (administrador, operador)",
  "GET /api/v1/organizacoes/:id": "Consulta uma organização (administrador, operador)",
  "PATCH /api/v1/organizacoes/:id": "Altera CNPJ/endereço ou desativa, com controle de versão (administrador, operador)",
  "POST /api/v1/organizacoes/:id/reativar": "Reativa organização com contrato vigente e controle de versão (administrador, operador)",
  "POST /api/v1/organizacoes/:id/contrato/encerrar": "Encerra contrato e desabilita renovação automática (administrador, operador)",
  "POST /api/v1/organizacoes/:id/contrato/encerrar-retroativo": "Corrige encerramento retroativo de contrato (somente administrador)",
  "POST /api/v1/organizacoes/:id/contrato": "Cria o contrato da organização (administrador, operador)",
  "POST /api/v1/organizacoes/:id/contrato/renovar": "Renova o contrato, com controle de versão (administrador, operador)",

  "POST /api/v1/lotes": "Registra lote, com equipamentos opcionais (administrador, gestor)",
  "GET /api/v1/lotes": "Lista lotes por período de entrada (administrador, gestor)",
  "GET /api/v1/lotes/:id": "Consulta um lote com seus equipamentos (administrador, gestor)",
  "POST /api/v1/lotes/:id/equipamentos": "Adiciona equipamentos a um lote aberto (administrador, gestor)",
  "POST /api/v1/lotes/:id/triagem": "Conclui a triagem do lote, com controle de versão (administrador, gestor)",

  "GET /api/v1/equipamentos/:id/historico": "Rastreabilidade: equipamento e movimentações (administrador, gestor, auditor)",
  "GET /api/v1/equipamentos/:id/depreciacao": "Calcula a depreciação acumulada (administrador, gestor)",
  "PATCH /api/v1/equipamentos/:id/estado-fisico": "Altera o estado físico, com controle de versão (administrador, gestor)",
  "PATCH /api/v1/equipamentos/:id/status": "Altera o status de rastreamento, com controle de versão (administrador, gestor)",
  "POST /api/v1/equipamentos/:id/movimentacoes": "Registra movimentação do equipamento (administrador, gestor)",
  "POST /api/v1/equipamentos/:id/triagem": "Registra a avaliação individual de triagem, com justificativa e controle de versão (administrador, gestor)",
  "POST /api/v1/equipamentos/:id/baixa-definitiva": "Registra a baixa definitiva autorizada, com justificativa, controle de versão e auditoria (somente administrador)",

  "GET /api/v1/relatorios/organizacao/:id": "Relatório por organização e período (administrador, auditor)",
  "GET /api/v1/relatorios/status": "Relatório de equipamentos por status (administrador, auditor)",
  "GET /api/v1/relatorios/financeiro": "Relatório financeiro dos contratos no período (administrador, auditor)",

  "GET /api/v1/configuracao": "Consulta os parâmetros globais (administrador)",
  "PATCH /api/v1/configuracao": "Altera alíquota, coeficiente e valor-base (administrador)",

  "POST /api/v1/usuarios": "Cria uma conta de acesso (administrador)",
  "GET /api/v1/usuarios": "Lista as contas de acesso (administrador)",

  "GET /api/v1/saude": "Verifica o servidor e a conexão com o banco",
};

const ROTAS_PUBLICAS = new Set([
  "POST /api/v1/auth/login",
  "POST /api/v1/auth/refresh",
  "POST /api/v1/auth/logout",
  "GET /api/v1/saude",
]);

export default fp(async (app) => {
  // Precisa ser registrado antes das rotas: o plugin lê cada rota ao ser criada
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Logística API",
        description:
          "Logística reversa de equipamentos eletrônicos. Faça login em POST /api/v1/auth/login, copie o accessToken e use o botão Authorize.",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    transform: ({ schema, url, route }) => {
      const metodo = String(
        Array.isArray(route.method) ? route.method[0] : route.method,
      ).toUpperCase();

      // O Fastify cria uma rota HEAD para cada GET
      if (metodo === "HEAD") {
        return { schema: { ...schema, hide: true }, url };
      }

      const caminho = route.url.length > 1 ? route.url.replace(/\/$/, "") : route.url;
      const chave = `${metodo} ${caminho}`;
      const segmento = caminho.split("/")[3] ?? "saude";

      return {
        schema: {
          ...schema,
          summary: RESUMOS[chave],
          tags: [TAGS[segmento] ?? segmento],
          security: ROTAS_PUBLICAS.has(chave) ? [] : [{ bearerAuth: [] }],
        },
        url: url.length > 1 ? url.replace(/\/$/, "") : url,
      };
    },
  });

  await app.register(swaggerUi, { routePrefix: "/docs" });
});
