import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import {
  alterarSenhaSchema,
  loginSchema,
  refreshSchema,
  type AlterarSenhaBody,
  type LoginBody,
  type RefreshBody,
} from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";

export default async function authRoutes(app: FastifyInstance) {
  const service = new AuthService((payload) => app.jwt.sign(payload));
  const controller = new AuthController(service);

  app.post<{ Body: LoginBody }>(
    "/login",
    { schema: loginSchema },
    controller.login,
  );

  app.post<{ Body: RefreshBody }>(
    "/refresh",
    { schema: refreshSchema },
    controller.renovar,
  );

  app.post<{ Body: RefreshBody }>(
    "/logout",
    { schema: refreshSchema },
    controller.logout,
  );

  app.post<{ Body: AlterarSenhaBody }>(
    "/alterar-senha",
    { schema: alterarSenhaSchema, onRequest: [app.autenticar] },
    controller.alterarSenha,
  );

  app.get("/me", { onRequest: [app.autenticar] }, controller.me);
}