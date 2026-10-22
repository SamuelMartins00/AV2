import type { FastifyInstance } from "fastify";
import { UsuariosController } from "./usuarios.controller.js";
import { criarUsuarioSchema, type CriarUsuarioBody } from "./usuarios.schemas.js";
import { UsuariosService } from "./usuarios.service.js";

export default async function usuariosRoutes(app: FastifyInstance) {
  const controller = new UsuariosController(new UsuariosService());

  // Gestão de contas de acesso: somente o administrador
  app.addHook("onRequest", app.autenticar);
  app.addHook("onRequest", app.exigirPapel("ADMINISTRADOR"));

  app.post<{ Body: CriarUsuarioBody }>(
    "/",
    { schema: criarUsuarioSchema },
    controller.criar,
  );

  app.get("/", controller.listar);
}
