import type { FastifyReply, FastifyRequest } from "fastify";
import type { ParamsId } from "../compartilhado/params.js";
import type {
  AtualizarEstadoBody,
  AvaliarTriagemBody,
  BaixaDefinitivaBody,
  AtualizarStatusBody,
  MovimentarBody,
  ListarEquipamentosQuery,
} from "./equipamentos.schemas.js";
import type { EquipamentosService } from "./equipamentos.service.js";

export class EquipamentosController {
  constructor(private readonly service: EquipamentosService) {}

  listar = async (request: FastifyRequest<{ Querystring: ListarEquipamentosQuery }>) => {
    return this.service.listar(request.query);
  };

  historico = async (request: FastifyRequest<{ Params: ParamsId }>) => {
    return this.service.rastrear(request.params.id);
  };

  depreciacao = async (request: FastifyRequest<{ Params: ParamsId }>) => {
    return this.service.depreciacao(request.params.id);
  };

  avaliarTriagem = async (
    request: FastifyRequest<{ Params: ParamsId; Body: AvaliarTriagemBody }>,
  ) => {
    return this.service.avaliarTriagem(request.params.id, request.body, request.user.usuario);
  };

  baixarDefinitivamente = async (
    request: FastifyRequest<{ Params: ParamsId; Body: BaixaDefinitivaBody }>,
  ) => {
    return this.service.baixarDefinitivamente(request.params.id, request.body, request.user.usuario);
  };

  atualizarEstado = async (
    request: FastifyRequest<{ Params: ParamsId; Body: AtualizarEstadoBody }>,
  ) => {
    return this.service.atualizarEstado(
      request.params.id,
      request.body,
      request.user.usuario,
    );
  };

  atualizarStatus = async (
    request: FastifyRequest<{ Params: ParamsId; Body: AtualizarStatusBody }>,
  ) => {
    return this.service.atualizarStatus(
      request.params.id,
      request.body,
      request.user.usuario,
    );
  };

  movimentar = async (
    request: FastifyRequest<{ Params: ParamsId; Body: MovimentarBody }>,
    reply: FastifyReply,
  ) => {
    const movimentacao = await this.service.movimentar(
      request.params.id,
      request.body,
      request.user.usuario,
    );
    return reply.status(201).send(movimentacao);
  };
}
