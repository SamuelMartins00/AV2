import type { FastifyReply, FastifyRequest } from "fastify";
import type { ParamsId } from "../compartilhado/params.js";
import type {
  AdicionarEquipamentosBody,
  CriarLoteBody,
  ListarLotesQuery,
  TriagemBody,
} from "./lotes.schemas.js";
import type { LotesService } from "./lotes.service.js";

export class LotesController {
  constructor(private readonly service: LotesService) {}

  criar = async (
    request: FastifyRequest<{ Body: CriarLoteBody }>,
    reply: FastifyReply,
  ) => {
    const lote = await this.service.criar(request.body, request.user.usuario);
    return reply.status(201).send(lote);
  };

  listar = async (request: FastifyRequest<{ Querystring: ListarLotesQuery }>) => {
    return this.service.listar(request.query);
  };

  buscar = async (request: FastifyRequest<{ Params: ParamsId }>) => {
    return this.service.buscar(request.params.id);
  };

  excluir = async (
    request: FastifyRequest<{ Params: ParamsId }>,
    reply: FastifyReply,
  ) => {
    await this.service.excluir(request.params.id, request.user.usuario);
    return reply.status(204).send();
  };

  adicionarEquipamentos = async (
    request: FastifyRequest<{ Params: ParamsId; Body: AdicionarEquipamentosBody }>,
    reply: FastifyReply,
  ) => {
    const lote = await this.service.adicionarEquipamentos(
      request.params.id,
      request.body,
      request.user.usuario,
    );
    return reply.status(201).send(lote);
  };

  concluirTriagem = async (
    request: FastifyRequest<{ Params: ParamsId; Body: TriagemBody }>,
  ) => {
    return this.service.concluirTriagem(
      request.params.id,
      request.body,
      request.user.usuario,
    );
  };
}
