export interface DadosContratoBody {
  dataAssinatura?: string;
  dataVencimento: string;
  clausulas?: string[];
  valorMensal: number;
  renovacaoAutomatica?: boolean;
}

export interface CriarOrganizacaoBody {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  enderecoCompleto: string;
  telefone?: string;
  email?: string;
  contrato?: DadosContratoBody;
}

export interface AtualizarOrganizacaoBody {
  versao: number;
  enderecoCompleto?: string;
  desativar?: true;
}

export interface RenovarContratoBody {
  novoVencimento: string;
  versao: number;
}

export interface ParamsId {
  id: number;
}

export interface ListarQuery {
  todas?: boolean;
}

const contratoProps = {
  dataAssinatura: { type: "string", minLength: 10, maxLength: 40 },
  dataVencimento: { type: "string", minLength: 10, maxLength: 40 },
  clausulas: {
    type: "array",
    maxItems: 50,
    items: { type: "string", minLength: 1, maxLength: 1000 },
  },
  valorMensal: { type: "number", minimum: 0 },
  renovacaoAutomatica: { type: "boolean" },
} as const;

const paramsId = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

export const criarOrganizacaoSchema = {
  body: {
    type: "object",
    required: ["razaoSocial", "cnpj", "enderecoCompleto"],
    additionalProperties: false,
    properties: {
      razaoSocial: { type: "string", minLength: 1, maxLength: 200 },
      cnpj: { type: "string", minLength: 14, maxLength: 18 },
      inscricaoEstadual: { type: "string", maxLength: 30 },
      enderecoCompleto: { type: "string", minLength: 1, maxLength: 1000 },
      telefone: { type: "string", maxLength: 30 },
      email: {
        type: "string",
        maxLength: 150,
        pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      },
      contrato: {
        type: "object",
        required: ["dataVencimento", "valorMensal"],
        additionalProperties: false,
        properties: contratoProps,
      },
    },
  },
} as const;

export const listarOrganizacoesSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: { todas: { type: "boolean" } },
  },
} as const;

export const buscarOrganizacaoSchema = { params: paramsId } as const;

export const atualizarOrganizacaoSchema = {
  params: paramsId,
  body: {
    type: "object",
    required: ["versao"],
    additionalProperties: false,
    properties: {
      versao: { type: "integer", minimum: 1 },
      enderecoCompleto: { type: "string", minLength: 1, maxLength: 1000 },
      desativar: { type: "boolean", enum: [true] },
    },
  },
} as const;

export const criarContratoSchema = {
  params: paramsId,
  body: {
    type: "object",
    required: ["dataVencimento", "valorMensal"],
    additionalProperties: false,
    properties: contratoProps,
  },
} as const;

export const renovarContratoSchema = {
  params: paramsId,
  body: {
    type: "object",
    required: ["novoVencimento", "versao"],
    additionalProperties: false,
    properties: {
      novoVencimento: { type: "string", minLength: 10, maxLength: 40 },
      versao: { type: "integer", minimum: 1 },
    },
  },
} as const;