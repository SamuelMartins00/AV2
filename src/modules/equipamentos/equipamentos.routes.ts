import type { FastifyInstance } from "fastify";
import type { ParamsId } from "../compartilhado/params.js";
import { EquipamentosController } from "./equipamentos.controller.js";
import {
  atualizarEstadoSchema,
  avaliarTriagemSchema,
  baixaDefinitivaSchema,
  atualizarStatusSchema,
  consultarEquipamentoSchema,
  excluirEquipamentoSchema,
  listarEquipamentosSchema,
  movimentarSchema,
  type AtualizarEstadoBody,
  type AvaliarTriagemBody,
  type BaixaDefinitivaBody,
  type AtualizarStatusBody,
  type MovimentarBody,
  type ListarEquipamentosQuery,
} from "./equipamentos.schemas.js";
import { EquipamentosService } from "./equipamentos.service.js";

export default async function equipamentosRoutes(app: FastifyInstance) {
  const controller = new EquipamentosController(new EquipamentosService());

  // O auditor só consulta; as demais ações são do gestor (e do administrador)
  const leitura = [
    app.autenticar,
    app.exigirPapel("ADMINISTRADOR", "GESTOR_ALMOXARIFADO", "AUDITOR"),
  ];
  const escrita = [
    app.autenticar,
    app.exigirPapel("ADMINISTRADOR", "GESTOR_ALMOXARIFADO"),
  ];

  app.get<{ Querystring: ListarEquipamentosQuery }>(
    "/",
    { schema: listarEquipamentosSchema, onRequest: leitura },
    controller.listar,
  );

  app.get<{ Params: ParamsId }>(
    "/:id/historico",
    { schema: consultarEquipamentoSchema, onRequest: leitura },
    controller.historico,
  );

  app.delete<{ Params: ParamsId }>(
    "/:id",
    { schema: excluirEquipamentoSchema, onRequest: escrita },
    controller.excluir,
  );

  app.get<{ Params: ParamsId }>(
    "/:id/depreciacao",
    { schema: consultarEquipamentoSchema, onRequest: escrita },
    controller.depreciacao,
  );

  app.post<{ Params: ParamsId; Body: AvaliarTriagemBody }>(
    "/:id/triagem",
    { schema: avaliarTriagemSchema, onRequest: escrita },
    controller.avaliarTriagem,
  );

  app.post<{ Params: ParamsId; Body: BaixaDefinitivaBody }>(
    "/:id/baixa-definitiva",
    { schema: baixaDefinitivaSchema, onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")] },
    controller.baixarDefinitivamente,
  );

  app.patch<{ Params: ParamsId; Body: AtualizarEstadoBody }>(
    "/:id/estado-fisico",
    { schema: atualizarEstadoSchema, onRequest: escrita },
    controller.atualizarEstado,
  );

  app.patch<{ Params: ParamsId; Body: AtualizarStatusBody }>(
    "/:id/status",
    { schema: atualizarStatusSchema, onRequest: escrita },
    controller.atualizarStatus,
  );

  app.post<{ Params: ParamsId; Body: MovimentarBody }>(
    "/:id/movimentacoes",
    { schema: movimentarSchema, onRequest: escrita },
    controller.movimentar,
  );
}
