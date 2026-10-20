import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { ErroDominio } from "../dominio/erros.js";
import type { Papel } from "../dominio/papel.js";

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: env.jwtSecret,
    sign: { expiresIn: env.jwtAccessExpira },
  });

  // 1º guard: exige um access token válido e preenche request.user
  app.decorate("autenticar", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new ErroDominio("Token ausente, inválido ou expirado", 401);
    }
  });

  // 2º guard: exige que o papel do usuário esteja na lista permitida
  app.decorate(
    "exigirPapel",
    (...papeis: Papel[]) =>
      async (request: FastifyRequest) => {
        if (!papeis.includes(request.user.papel)) {
          throw new ErroDominio("Sem permissão para esta ação", 403);
        }
      },
  );
});