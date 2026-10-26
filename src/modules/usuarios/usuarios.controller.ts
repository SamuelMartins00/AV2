import type { FastifyReply, FastifyRequest } from "fastify";
import type { AtualizarMeuNomeBody, AtualizarUsuarioBody, CriarUsuarioBody, ListarUsuariosQuery, RedefinirSenhaBody } from "./usuarios.schemas.js";
import type { UsuariosService } from "./usuarios.service.js";

type IdParams = { id: string };

export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  criar = async (request: FastifyRequest<{ Body: CriarUsuarioBody }>, reply: FastifyReply) => {
    const usuario = await this.service.criar(request.body, Number(request.user.sub), request.user.usuario);
    return reply.status(201).send(usuario);
  };

  listar = async (request: FastifyRequest<{ Querystring: ListarUsuariosQuery }>) => this.service.listar(request.query);

  buscar = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const usuario = await this.service.buscar(Number(request.params.id));
    return reply.send(usuario);
  };

  atualizar = async (request: FastifyRequest<{ Params: IdParams; Body: AtualizarUsuarioBody }>, reply: FastifyReply) => {
    const usuario = await this.service.atualizar(Number(request.params.id), request.body, Number(request.user.sub), request.user.usuario);
    return reply.send(usuario);
  };

  atualizarMeuNome = async (request: FastifyRequest<{ Body: AtualizarMeuNomeBody }>) =>
    this.service.atualizarMeuNome(Number(request.user.sub), request.body.nomeExibicao, request.user.usuario);

  excluir = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    await this.service.excluir(Number(request.params.id), Number(request.user.sub), request.user.usuario);
    return reply.status(204).send();
  };

  redefinirSenha = async (request: FastifyRequest<{ Params: IdParams; Body: RedefinirSenhaBody }>, reply: FastifyReply) => {
    await this.service.redefinirSenha(Number(request.params.id), request.body.senhaNova, Number(request.user.sub), request.user.usuario);
    return reply.status(204).send();
  };

  desativar = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    return reply.send(await this.service.alterarSituacao(Number(request.params.id), false, Number(request.user.sub), request.user.usuario));
  };

  reativar = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    return reply.send(await this.service.alterarSituacao(Number(request.params.id), true, Number(request.user.sub), request.user.usuario));
  };
}
