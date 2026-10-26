import type { FastifyInstance } from "fastify";
import { UsuariosController } from "./usuarios.controller.js";
import {
  atualizarMeuNomeSchema, atualizarUsuarioSchema, criarUsuarioSchema, idUsuarioSchema,
  listarUsuariosSchema, redefinirSenhaSchema,
  type AtualizarMeuNomeBody, type AtualizarUsuarioBody, type CriarUsuarioBody,
  type ListarUsuariosQuery, type RedefinirSenhaBody,
} from "./usuarios.schemas.js";
import { UsuariosService } from "./usuarios.service.js";

export default async function usuariosRoutes(app: FastifyInstance) {
  const controller = new UsuariosController(new UsuariosService());

  app.get("/me", { onRequest: [app.autenticar] }, async (request) => ({
    id: Number(request.user.sub), usuario: request.user.usuario, nomeExibicao: request.user.nomeExibicao, papel: request.user.papel,
  }));
  app.patch<{ Body: AtualizarMeuNomeBody }>("/me", { onRequest: [app.autenticar], schema: atualizarMeuNomeSchema }, controller.atualizarMeuNome);

  app.post<{ Body: CriarUsuarioBody }>("/", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: criarUsuarioSchema }, controller.criar);
  app.get<{ Querystring: ListarUsuariosQuery }>("/", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: listarUsuariosSchema }, controller.listar);
  app.get<{ Params: { id: string } }>("/:id", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: idUsuarioSchema }, controller.buscar);
  app.patch<{ Params: { id: string }; Body: AtualizarUsuarioBody }>("/:id", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: atualizarUsuarioSchema }, controller.atualizar);
  app.put<{ Params: { id: string }; Body: RedefinirSenhaBody }>("/:id/senha", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: redefinirSenhaSchema }, controller.redefinirSenha);
  app.delete<{ Params: { id: string } }>("/:id", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: idUsuarioSchema }, controller.excluir);
  app.patch<{ Params: { id: string } }>("/:id/desativar", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: idUsuarioSchema }, controller.desativar);
  app.patch<{ Params: { id: string } }>("/:id/reativar", { onRequest: [app.autenticar, app.exigirPapel("ADMINISTRADOR")], schema: idUsuarioSchema }, controller.reativar);
}
