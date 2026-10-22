import {
  STATUS_RASTREAMENTO,
  type StatusRastreamento,
} from "../../dominio/enums.js";
import { paramsIdSchema } from "../compartilhado/params.js";

export interface PeriodoQuery {
  inicio: string;
  fim: string;
}

export interface StatusQuery {
  status: StatusRastreamento;
}

const periodoQuery = {
  type: "object",
  required: ["inicio", "fim"],
  additionalProperties: false,
  properties: {
    inicio: { type: "string", minLength: 10, maxLength: 40 },
    fim: { type: "string", minLength: 10, maxLength: 40 },
  },
} as const;

export const relatorioOrganizacaoSchema = {
  params: paramsIdSchema,
  querystring: periodoQuery,
} as const;

export const relatorioStatusSchema = {
  querystring: {
    type: "object",
    required: ["status"],
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: [...STATUS_RASTREAMENTO] },
    },
  },
} as const;

export const relatorioFinanceiroSchema = { querystring: periodoQuery } as const;
