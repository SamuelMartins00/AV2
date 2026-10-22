import type { FastifyReply, FastifyRequest } from "fastify";
import type { CriarUsuarioBody } from "./usuarios.schemas.js";
import type { UsuariosService } from "./usuarios.service.js";

export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  criar = async (
    request: FastifyRequest<{ Body: CriarUsuarioBody }>,
    reply: FastifyReply,
  ) => {
    const usuario = await this.service.criar(request.body, request.user.usuario);
    return reply.status(201).send(usuario);
  };

  listar = async () => this.service.listar();
}
