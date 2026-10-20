import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  AlterarSenhaBody,
  LoginBody,
  RefreshBody,
} from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (request: FastifyRequest<{ Body: LoginBody }>) => {
    const { usuario, senha } = request.body;
    return this.service.login(usuario, senha);
  };

  renovar = async (request: FastifyRequest<{ Body: RefreshBody }>) => {
    return this.service.renovar(request.body.refreshToken);
  };

  logout = async (
    request: FastifyRequest<{ Body: RefreshBody }>,
    reply: FastifyReply,
  ) => {
    await this.service.logout(request.body.refreshToken);
    return reply.status(204).send();
  };

  alterarSenha = async (
    request: FastifyRequest<{ Body: AlterarSenhaBody }>,
    reply: FastifyReply,
  ) => {
    const { senhaAtual, senhaNova } = request.body;
    await this.service.alterarSenha(
      Number(request.user.sub),
      senhaAtual,
      senhaNova,
    );
    return reply.status(204).send();
  };

  me = async (request: FastifyRequest) => {
    return this.service.perfil(Number(request.user.sub));
  };
}