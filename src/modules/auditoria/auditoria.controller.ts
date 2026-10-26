import type { FastifyRequest } from "fastify";
import type { ConsultaJournalQuery } from "./auditoria.schemas.js";
import type { AuditoriaService } from "./auditoria.service.js";

export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  listar = async (request: FastifyRequest<{ Querystring: ConsultaJournalQuery }>) =>
    this.service.listar(request.query);
}
