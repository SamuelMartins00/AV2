import type { FastifyInstance } from "fastify";
import { AuditoriaController } from "./auditoria.controller.js";
import { consultaJournalSchema, type ConsultaJournalQuery } from "./auditoria.schemas.js";
import { AuditoriaService } from "./auditoria.service.js";

export default async function auditoriaRoutes(app: FastifyInstance) {
  const controller = new AuditoriaController(new AuditoriaService());
  app.addHook("onRequest", app.autenticar);
  app.addHook("onRequest", app.exigirPapel("ADMINISTRADOR", "AUDITOR"));

  app.get<{ Querystring: ConsultaJournalQuery }>(
    "/journal",
    { schema: consultaJournalSchema },
    controller.listar,
  );
}
