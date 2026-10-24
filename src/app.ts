import Fastify, { type FastifyError } from "fastify";
import { prisma } from "./config/prisma.js";
import authRoutes from "./modules/auth/auth.routes.js";
import configuracaoRoutes from "./modules/configuracao/configuracao.routes.js";
import equipamentosRoutes from "./modules/equipamentos/equipamentos.routes.js";
import lotesRoutes from "./modules/lotes/lotes.routes.js";
import organizacoesRoutes from "./modules/organizacoes/organizacoes.routes.js";
import relatoriosRoutes from "./modules/relatorios/relatorios.routes.js";
import usuariosRoutes from "./modules/usuarios/usuarios.routes.js";
import authPlugin from "./plugins/auth.js";
import swaggerPlugin from "./plugins/swagger.js";

export function buildApp(opcoes: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opcoes.logger ?? true });

  app.setErrorHandler((erro: FastifyError, request, reply) => {
    const status =
      erro.statusCode && erro.statusCode >= 400 ? erro.statusCode : 500;

    if (status >= 500) {
      request.log.error(erro);
    }

    reply.status(status).send({
      erro: status >= 500 ? "Erro interno do servidor" : erro.message,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ erro: "Rota não encontrada" });
  });

  // A ordem importa: autenticação e Swagger devem vir antes das rotas
  app.register(authPlugin);
  app.register(swaggerPlugin);
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(organizacoesRoutes, { prefix: "/api/v1/organizacoes" });
  app.register(lotesRoutes, { prefix: "/api/v1/lotes" });
  app.register(equipamentosRoutes, { prefix: "/api/v1/equipamentos" });
  app.register(relatoriosRoutes, { prefix: "/api/v1/relatorios" });
  app.register(configuracaoRoutes, { prefix: "/api/v1/configuracao" });
  app.register(usuariosRoutes, { prefix: "/api/v1/usuarios" });

  // Registrada como plugin para que o Swagger a enxergue (ele só lê rotas criadas depois do seu próprio registro)
  app.register(async (instancia) => {
    instancia.get("/api/v1/saude", async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    });
  });

  return app;
}
