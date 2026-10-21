import {
  ESTADOS_FISICOS,
  STATUS_RASTREAMENTO,
  type EstadoFisico,
  type StatusRastreamento,
} from "../../dominio/enums.js";
import { paramsIdSchema } from "../compartilhado/params.js";

export interface AtualizarEstadoBody {
  versao: number;
  novoEstado: EstadoFisico;
  justificativa?: string;
}

export interface AtualizarStatusBody {
  versao: number;
  novoStatus: StatusRastreamento;
  justificativa: string;
}

export interface MovimentarBody {
  destino: string;
  observacao?: string;
}

export const consultarEquipamentoSchema = { params: paramsIdSchema } as const;

export const atualizarEstadoSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["versao", "novoEstado"],
    additionalProperties: false,
    properties: {
      versao: { type: "integer", minimum: 1 },
      novoEstado: { type: "string", enum: [...ESTADOS_FISICOS] },
      justificativa: { type: "string", maxLength: 1000 },
    },
  },
} as const;

export const atualizarStatusSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["versao", "novoStatus", "justificativa"],
    additionalProperties: false,
    properties: {
      versao: { type: "integer", minimum: 1 },
      novoStatus: { type: "string", enum: [...STATUS_RASTREAMENTO] },
      justificativa: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
} as const;

export const movimentarSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["destino"],
    additionalProperties: false,
    properties: {
      destino: { type: "string", minLength: 1, maxLength: 200 },
      observacao: { type: "string", maxLength: 1000 },
    },
  },
} as const;
