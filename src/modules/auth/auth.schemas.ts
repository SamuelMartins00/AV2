export interface LoginBody {
  usuario: string;
  senha: string;
}

export interface RefreshBody {
  refreshToken: string;
}

export interface AlterarSenhaBody {
  senhaAtual: string;
  senhaNova: string;
}

export const loginSchema = {
  body: {
    type: "object",
    required: ["usuario", "senha"],
    additionalProperties: false,
    properties: {
      usuario: { type: "string", minLength: 1, maxLength: 100 },
      senha: { type: "string", minLength: 1, maxLength: 200 },
    },
  },
} as const;

export const refreshSchema = {
  body: {
    type: "object",
    required: ["refreshToken"],
    additionalProperties: false,
    properties: {
      refreshToken: { type: "string", minLength: 1, maxLength: 200 },
    },
  },
} as const;

export const alterarSenhaSchema = {
  body: {
    type: "object",
    required: ["senhaAtual", "senhaNova"],
    additionalProperties: false,
    properties: {
      senhaAtual: { type: "string", minLength: 1, maxLength: 200 },
      senhaNova: { type: "string", minLength: 8, maxLength: 72 },
    },
  },
} as const;