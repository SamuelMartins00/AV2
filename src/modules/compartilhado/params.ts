export interface ParamsId {
  id: number;
}

export const paramsIdSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

export const MSG_CONFLITO =
  "O registro foi alterado por outra requisição. Recarregue e tente novamente.";

export type ResultadoEscrita<T> =
  | { tipo: "ok"; valor: T }
  | { tipo: "conflito" }
  | { tipo: "nao_encontrada" };
