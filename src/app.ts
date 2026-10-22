import Fastify, { type FastifyError } from "fastify";
import { prisma } from "./config/prisma.js";
import authRoutes from "./modules/auth/auth.routes.js";
import authPlugin from "./plugins/auth.js";
import organizacoesRoutes from "./modules/organizacoes/organizacoes.routes.js";
import equipamentosRoutes from "./modules/equipamentos/equipamentos.routes.js";
import lotesRoutes from "./modules/lotes/lotes.routes.js";
import relatoriosRoutes from "./modules/relatorios/relatorios.routes.js";
import configuracaoRoutes from "./modules/configuracao/configuracao.routes.js";
import usuariosRoutes from "./modules/usuarios/usuarios.routes.js";

export function buildApp() {
  const app = Fastify({ logger: true });

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

  // A ordem importa: o plugin de autenticação deve vir antes das rotas
  app.register(authPlugin);
  app.register(authRoutes, { prefix: "/api/v1/auth" });

  app.get("/api/v1/saude", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  });

  app.register(organizacoesRoutes, { prefix: "/api/v1/organizacoes" });
  app.register(lotesRoutes, { prefix: "/api/v1/lotes" });
  app.register(equipamentosRoutes, { prefix: "/api/v1/equipamentos" });
  app.register(relatoriosRoutes, { prefix: "/api/v1/relatorios" });
  app.register(configuracaoRoutes, { prefix: "/api/v1/configuracao" });
  app.register(usuariosRoutes, { prefix: "/api/v1/usuarios" });

  return app;
}