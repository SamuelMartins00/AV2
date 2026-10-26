import {
  ESTADOS_FISICOS,
  STATUS_RASTREAMENTO,
  RESULTADOS_TRIAGEM,
  type ResultadoTriagem,
  type EstadoFisico,
  type StatusRastreamento,
  type TipoEquipamento,
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

export interface AvaliarTriagemBody {
  versao: number;
  resultadoTriagem: Exclude<ResultadoTriagem, "AGUARDANDO_AVALIACAO">;
  justificativa: string;
}

export interface BaixaDefinitivaBody {
  versao: number;
  justificativa: string;
}

export interface ListarEquipamentosQuery {
  loteId?: number;
  codigoBarrasInterno?: string;
  statusRastreamento?: StatusRastreamento;
  resultadoTriagem?: ResultadoTriagem;
  tipo?: TipoEquipamento;
}

export interface MovimentarBody {
  destino: string;
  observacao?: string;
}

export const consultarEquipamentoSchema = { params: paramsIdSchema } as const;

export const listarEquipamentosSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      loteId: { type: "integer", minimum: 1 },
      codigoBarrasInterno: { type: "string", minLength: 1, maxLength: 100 },
      statusRastreamento: { type: "string", enum: [...STATUS_RASTREAMENTO] },
      resultadoTriagem: { type: "string", enum: [...RESULTADOS_TRIAGEM] },
      tipo: { type: "string", enum: ["COMPUTADOR_MESA", "NOTEBOOK", "MONITOR", "IMPRESSORA", "SERVIDOR", "ROTEADOR", "CABO_ESTRUTURADO", "FONTE_ALIMENTACAO"] },
    },
  },
} as const;

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

export const avaliarTriagemSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["versao", "resultadoTriagem", "justificativa"],
    additionalProperties: false,
    properties: {
      versao: { type: "integer", minimum: 1 },
      resultadoTriagem: { type: "string", enum: RESULTADOS_TRIAGEM.filter((r) => r !== "AGUARDANDO_AVALIACAO") },
      justificativa: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
} as const;

export const baixaDefinitivaSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["versao", "justificativa"],
    additionalProperties: false,
    properties: {
      versao: { type: "integer", minimum: 1 },
      justificativa: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
} as const;

export const excluirEquipamentoSchema = {
  params: paramsIdSchema,
  summary: "Excluir equipamento sem histórico",
  description:
    "Disponível para ADMINISTRADOR e GESTOR_ALMOXARIFADO. Só permite exclusão física se o equipamento permanecer no estado inicial, sem movimentações nem eventos operacionais no journal. Triagem, desmontagem, baixa definitiva e demais alterações históricas bloqueiam a exclusão. O evento de exclusão é gravado atomicamente.",
  response: {
    204: { description: "Equipamento excluído." },
    400: {
      type: "object",
      properties: { erro: { type: "string" } },
      required: ["erro"],
    },
    401: {
      type: "object",
      properties: { erro: { type: "string" } },
      required: ["erro"],
    },
    403: {
      type: "object",
      properties: { erro: { type: "string" } },
      required: ["erro"],
    },
    404: {
      type: "object",
      properties: { erro: { type: "string" } },
      required: ["erro"],
    },
    409: {
      type: "object",
      properties: { erro: { type: "string" } },
      required: ["erro"],
    },
  },
} as const;
