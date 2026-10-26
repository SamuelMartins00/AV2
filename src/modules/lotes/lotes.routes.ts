import type { FastifyInstance } from "fastify";
import type { ParamsId } from "../compartilhado/params.js";
import { LotesController } from "./lotes.controller.js";
import {
  adicionarEquipamentosSchema,
  buscarLoteSchema,
  criarLoteSchema,
  excluirLoteSchema,
  listarLotesSchema,
  triagemSchema,
  type AdicionarEquipamentosBody,
  type CriarLoteBody,
  type ListarLotesQuery,
  type TriagemBody,
} from "./lotes.schemas.js";
import { LotesService } from "./lotes.service.js";

export default async function lotesRoutes(app: FastifyInstance) {
  const controller = new LotesController(new LotesService());

  app.addHook("onRequest", app.autenticar);
  app.addHook(
    "onRequest",
    app.exigirPapel("ADMINISTRADOR", "GESTOR_ALMOXARIFADO"),
  );

  app.post<{ Body: CriarLoteBody }>(
    "/",
    { schema: criarLoteSchema },
    controller.criar,
  );

  app.get<{ Querystring: ListarLotesQuery }>(
    "/",
    { schema: listarLotesSchema },
    controller.listar,
  );

  app.get<{ Params: ParamsId }>(
    "/:id",
    { schema: buscarLoteSchema },
    controller.buscar,
  );

  app.delete<{ Params: ParamsId }>(
    "/:id",
    { schema: excluirLoteSchema },
    controller.excluir,
  );

  app.post<{ Params: ParamsId; Body: AdicionarEquipamentosBody }>(
    "/:id/equipamentos",
    { schema: adicionarEquipamentosSchema },
    controller.adicionarEquipamentos,
  );

  app.post<{ Params: ParamsId; Body: TriagemBody }>(
    "/:id/triagem",
    { schema: triagemSchema },
    controller.concluirTriagem,
  );
}
