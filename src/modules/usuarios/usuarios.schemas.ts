import { PAPEIS, type Papel } from "../../dominio/papel.js";

export interface CriarUsuarioBody {
  usuario: string;
  senha: string;
  papel: Papel;
}

export const criarUsuarioSchema = {
  body: {
    type: "object",
    required: ["usuario", "senha", "papel"],
    additionalProperties: false,
    properties: {
      usuario: {
        type: "string",
        minLength: 3,
        maxLength: 50,
        pattern: "^[A-Za-z0-9._-]+$",
      },
      // Mesmo limite do alterar-senha: o bcrypt só considera os 72 primeiros bytes
      senha: { type: "string", minLength: 8, maxLength: 72 },
      papel: { type: "string", enum: [...PAPEIS] },
    },
  },
} as const;
