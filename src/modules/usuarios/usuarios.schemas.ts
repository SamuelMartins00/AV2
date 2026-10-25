import { PAPEIS, type Papel } from "../../dominio/papel.js";

export interface CriarUsuarioBody {
  usuario: string;
  nomeExibicao: string;
  senha: string;
  papel: Papel;
  senhaAtualAdmin?: string;
}

export interface AtualizarUsuarioBody {
  nomeExibicao?: string;
  papel?: Papel;
  senhaAtualAdmin?: string;
}

export interface AtualizarMeuNomeBody {
  nomeExibicao: string;
}

export interface RedefinirSenhaBody {
  senhaNova: string;
}

export interface ListarUsuariosQuery {
  page?: number;
  limit?: number;
  papel?: Papel;
  ativo?: boolean;
}

const nomeExibicao = {
  type: "string",
  minLength: 2,
  maxLength: 100,
  pattern: ".*\\S.*",
} as const;

export const criarUsuarioSchema = {
  body: {
    type: "object",
    required: ["usuario", "nomeExibicao", "senha", "papel"],
    additionalProperties: false,
    properties: {
      usuario: { type: "string", minLength: 3, maxLength: 50, pattern: "^[A-Za-z0-9._-]+$" },
      nomeExibicao,
      senha: { type: "string", minLength: 8, maxLength: 72 },
      papel: { type: "string", enum: [...PAPEIS] },
      senhaAtualAdmin: { type: "string", minLength: 1, maxLength: 72 },
    },
  },
} as const;

export const atualizarUsuarioSchema = {
  params: { type: "object", required: ["id"], additionalProperties: false, properties: { id: { type: "string", pattern: "^[1-9][0-9]*$" } } },
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      nomeExibicao,
      papel: { type: "string", enum: [...PAPEIS] },
      senhaAtualAdmin: { type: "string", minLength: 1, maxLength: 72 },
    },
  },
} as const;

export const idUsuarioSchema = {
  params: { type: "object", required: ["id"], additionalProperties: false, properties: { id: { type: "string", pattern: "^[1-9][0-9]*$" } } },
} as const;

export const atualizarMeuNomeSchema = {
  body: { type: "object", required: ["nomeExibicao"], additionalProperties: false, properties: { nomeExibicao } },
} as const;

export const redefinirSenhaSchema = {
  params: { type: "object", required: ["id"], additionalProperties: false, properties: { id: { type: "string", pattern: "^[1-9][0-9]*$" } } },
  body: { type: "object", required: ["senhaNova"], additionalProperties: false, properties: { senhaNova: { type: "string", minLength: 8, maxLength: 72 } } },
} as const;

export const listarUsuariosSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      papel: { type: "string", enum: [...PAPEIS] },
      ativo: { type: "boolean" },
    },
  },
} as const;
