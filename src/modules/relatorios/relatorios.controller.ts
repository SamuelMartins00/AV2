import type { FastifyRequest } from "fastify";
import type { ParamsId } from "../compartilhado/params.js";
import type { PeriodoQuery, StatusQuery } from "./relatorios.schemas.js";
import type { RelatoriosService } from "./relatorios.service.js";

export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  porOrganizacao = async (
    request: FastifyRequest<{ Params: ParamsId; Querystring: PeriodoQuery }>,
  ) => {
    return this.service.porOrganizacao(request.params.id, request.query);
  };

  porStatus = async (request: FastifyRequest<{ Querystring: StatusQuery }>) => {
    return this.service.porStatus(request.query);
  };

  financeiro = async (request: FastifyRequest<{ Querystring: PeriodoQuery }>) => {
    return this.service.financeiro(request.query);
  };
}
