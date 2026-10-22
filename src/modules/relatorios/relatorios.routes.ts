import type { FastifyInstance } from "fastify";
import type { ParamsId } from "../compartilhado/params.js";
import { RelatoriosController } from "./relatorios.controller.js";
import {
  relatorioFinanceiroSchema,
  relatorioOrganizacaoSchema,
  relatorioStatusSchema,
  type PeriodoQuery,
  type StatusQuery,
} from "./relatorios.schemas.js";
import { RelatoriosService } from "./relatorios.service.js";

export default async function relatoriosRoutes(app: FastifyInstance) {
  const controller = new RelatoriosController(new RelatoriosService());

  // Relatórios são só leitura: administrador e auditor
  app.addHook("onRequest", app.autenticar);
  app.addHook("onRequest", app.exigirPapel("ADMINISTRADOR", "AUDITOR"));

  app.get<{ Params: ParamsId; Querystring: PeriodoQuery }>(
    "/organizacao/:id",
    { schema: relatorioOrganizacaoSchema },
    controller.porOrganizacao,
  );

  app.get<{ Querystring: StatusQuery }>(
    "/status",
    { schema: relatorioStatusSchema },
    controller.porStatus,
  );

  app.get<{ Querystring: PeriodoQuery }>(
    "/financeiro",
    { schema: relatorioFinanceiroSchema },
    controller.financeiro,
  );
}
