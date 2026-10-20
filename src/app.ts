import Fastify from "fastify";
import { prisma } from "./config/prisma.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((erro, request, reply) => {
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

  app.get("/api/v1/saude", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  });

  return app;
}