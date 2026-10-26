import {
  ESTADOS_FISICOS,
  TIPOS_EQUIPAMENTO,
  STATUS_LOTE,
  type StatusLote,
  type EstadoFisico,
  type TipoEquipamento,
} from "../../dominio/enums.js";
import { paramsIdSchema } from "../compartilhado/params.js";

export interface DadosEquipamentoBody {
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
}

export interface CriarLoteBody {
  dataEntrada: string;
  organizacaoId: number;
  notaFiscal: string;
  transportadora: string;
  observacoes?: string;
  equipamentos?: DadosEquipamentoBody[];
}

export interface AdicionarEquipamentosBody {
  equipamentos: DadosEquipamentoBody[];
}

export interface TriagemBody {
  versao: number;
}

export interface ListarLotesQuery {
  inicio?: string;
  fim?: string;
  organizacaoId?: number;
  statusProcessamento?: StatusLote;
  notaFiscal?: string;
}

const equipamentoSchema = {
  type: "object",
  required: [
    "tipo",
    "marca",
    "modelo",
    "anoFabricacao",
    "estadoFisico",
    "pesoQuilogramas",
  ],
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: [...TIPOS_EQUIPAMENTO] },
    marca: { type: "string", minLength: 1, maxLength: 100 },
    modelo: { type: "string", minLength: 1, maxLength: 100 },
    anoFabricacao: { type: "integer", minimum: 1950, maximum: 2100 },
    estadoFisico: { type: "string", enum: [...ESTADOS_FISICOS] },
    pesoQuilogramas: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 99999.999,
    },
  },
} as const;

export const criarLoteSchema = {
  body: {
    type: "object",
    required: ["dataEntrada", "organizacaoId", "notaFiscal", "transportadora"],
    additionalProperties: false,
    properties: {
      dataEntrada: { type: "string", minLength: 10, maxLength: 40 },
      organizacaoId: { type: "integer", minimum: 1 },
      notaFiscal: { type: "string", minLength: 1, maxLength: 60 },
      transportadora: { type: "string", minLength: 1, maxLength: 120 },
      observacoes: { type: "string", maxLength: 2000 },
      equipamentos: { type: "array", maxItems: 500, items: equipamentoSchema },
    },
  },
} as const;

export const listarLotesSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      inicio: { type: "string", minLength: 10, maxLength: 40 },
      fim: { type: "string", minLength: 10, maxLength: 40 },
      organizacaoId: { type: "integer", minimum: 1 },
      statusProcessamento: { type: "string", enum: [...STATUS_LOTE] },
      notaFiscal: { type: "string", minLength: 1, maxLength: 60 },
    },
  },
} as const;

export const buscarLoteSchema = { params: paramsIdSchema } as const;

export const adicionarEquipamentosSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["equipamentos"],
    additionalProperties: false,
    properties: {
      equipamentos: {
        type: "array",
        minItems: 1,
        maxItems: 500,
        items: equipamentoSchema,
      },
    },
  },
} as const;

export const triagemSchema = {
  params: paramsIdSchema,
  body: {
    type: "object",
    required: ["versao"],
    additionalProperties: false,
    properties: { versao: { type: "integer", minimum: 1 } },
  },
} as const;
