import type { FastifyRequest } from "fastify";
import type { AtualizarConfiguracaoBody } from "./configuracao.schemas.js";
import type { ConfiguracaoService } from "./configuracao.service.js";

export class ConfiguracaoController {
  constructor(private readonly service: ConfiguracaoService) {}

  obter = async () => this.service.obter();

  atualizar = async (
    request: FastifyRequest<{ Body: AtualizarConfiguracaoBody }>,
  ) => {
    return this.service.atualizar(request.body, request.user.usuario);
  };
}
