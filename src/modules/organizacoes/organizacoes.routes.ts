import type { FastifyInstance } from "fastify";
import { OrganizacoesController } from "./organizacoes.controller.js";
import {
  atualizarOrganizacaoSchema,
  buscarOrganizacaoSchema,
  criarContratoSchema,
  criarOrganizacaoSchema,
  listarOrganizacoesSchema,
  renovarContratoSchema,
  type AtualizarOrganizacaoBody,
  type CriarOrganizacaoBody,
  type DadosContratoBody,
  type ListarQuery,
  type ParamsId,
  type RenovarContratoBody,
} from "./organizacoes.schemas.js";
import { OrganizacoesService } from "./organizacoes.service.js";

export default async function organizacoesRoutes(app: FastifyInstance) {
  const controller = new OrganizacoesController(new OrganizacoesService());

  app.addHook("onRequest", app.autenticar);
  app.addHook(
    "onRequest",
    app.exigirPapel("ADMINISTRADOR", "OPERADOR_CADASTRO"),
  );

  app.post<{ Body: CriarOrganizacaoBody }>(
    "/",
    { schema: criarOrganizacaoSchema },
    controller.criar,
  );

  app.get<{ Querystring: ListarQuery }>(
    "/",
    { schema: listarOrganizacoesSchema },
    controller.listar,
  );

  app.get<{ Params: ParamsId }>(
    "/:id",
    { schema: buscarOrganizacaoSchema },
    controller.buscar,
  );

  app.patch<{ Params: ParamsId; Body: AtualizarOrganizacaoBody }>(
    "/:id",
    { schema: atualizarOrganizacaoSchema },
    controller.atualizar,
  );

  app.post<{ Params: ParamsId; Body: DadosContratoBody }>(
    "/:id/contrato",
    { schema: criarContratoSchema },
    controller.criarContrato,
  );

  app.post<{ Params: ParamsId; Body: RenovarContratoBody }>(
    "/:id/contrato/renovar",
    { schema: renovarContratoSchema },
    controller.renovarContrato,
  );
}