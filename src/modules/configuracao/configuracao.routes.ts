import type { FastifyInstance } from "fastify";
import { ConfiguracaoController } from "./configuracao.controller.js";
import {
  atualizarConfiguracaoSchema,
  type AtualizarConfiguracaoBody,
} from "./configuracao.schemas.js";
import { ConfiguracaoService } from "./configuracao.service.js";

export default async function configuracaoRoutes(app: FastifyInstance) {
  const controller = new ConfiguracaoController(new ConfiguracaoService());

  // Parâmetros globais: somente o administrador
  app.addHook("onRequest", app.autenticar);
  app.addHook("onRequest", app.exigirPapel("ADMINISTRADOR"));

  app.get("/", controller.obter);

  app.patch<{ Body: AtualizarConfiguracaoBody }>(
    "/",
    { schema: atualizarConfiguracaoSchema },
    controller.atualizar,
  );
}
