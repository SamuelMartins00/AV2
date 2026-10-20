import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  AtualizarOrganizacaoBody,
  CriarOrganizacaoBody,
  DadosContratoBody,
  ListarQuery,
  ParamsId,
  RenovarContratoBody,
} from "./organizacoes.schemas.js";
import type { OrganizacoesService } from "./organizacoes.service.js";

export class OrganizacoesController {
  constructor(private readonly service: OrganizacoesService) {}

  criar = async (
    request: FastifyRequest<{ Body: CriarOrganizacaoBody }>,
    reply: FastifyReply,
  ) => {
    const org = await this.service.criar(request.body, request.user.usuario);
    return reply.status(201).send(org);
  };

  listar = async (request: FastifyRequest<{ Querystring: ListarQuery }>) => {
    return this.service.listar(request.query.todas === true);
  };

  buscar = async (request: FastifyRequest<{ Params: ParamsId }>) => {
    return this.service.buscar(request.params.id);
  };

  atualizar = async (
    request: FastifyRequest<{
      Params: ParamsId;
      Body: AtualizarOrganizacaoBody;
    }>,
  ) => {
    return this.service.atualizar(
      request.params.id,
      request.body,
      request.user.usuario,
    );
  };

  criarContrato = async (
    request: FastifyRequest<{ Params: ParamsId; Body: DadosContratoBody }>,
    reply: FastifyReply,
  ) => {
    const org = await this.service.criarContrato(
      request.params.id,
      request.body,
      request.user.usuario,
    );
    return reply.status(201).send(org);
  };

  renovarContrato = async (
    request: FastifyRequest<{ Params: ParamsId; Body: RenovarContratoBody }>,
  ) => {
    return this.service.renovarContrato(
      request.params.id,
      request.body,
      request.user.usuario,
    );
  };
}