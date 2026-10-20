import "@fastify/jwt";
import type { FastifyRequest } from "fastify";
import type { Papel } from "../dominio/papel.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; usuario: string; papel: Papel };
    user: { sub: string; usuario: string; papel: Papel; iat: number; exp: number };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    autenticar: (request: FastifyRequest) => Promise<void>;
    exigirPapel: (
      ...papeis: Papel[]
    ) => (request: FastifyRequest) => Promise<void>;
  }
}   