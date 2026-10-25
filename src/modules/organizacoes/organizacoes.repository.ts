import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { registrarJournal } from "../auditoria/journal.js";

const comContrato = { contrato: true } as const;

export interface DadosNovaOrganizacao {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  enderecoCompleto: string;
  telefone?: string;
  email?: string;
}

export interface DadosNovoContrato {
  dataAssinatura: Date;
  dataVencimento: Date;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica: boolean;
  duracaoRenovacaoMeses?: number;
}

export type ResultadoEscrita<T> =
  | { tipo: "ok"; valor: T }
  | { tipo: "conflito" }
  | { tipo: "nao_encontrada" }
  | { tipo: "encerrado" }
  | { tipo: "contrato_invalido" };

export interface FiltrosOrganizacoes {
  incluirInativas: boolean;
  page: number;
  limit: number;
  razaoSocial?: string;
  cnpj?: string;
  ativo?: boolean;
}

export const organizacoesRepository = {
  buscarPorId(id: number) {
    return prisma.organizacao.findUnique({ where: { id }, include: comContrato });
  },

  buscarPorCnpj(cnpj: string) {
    return prisma.organizacao.findUnique({ where: { cnpj } });
  },

  listar(filtros: FiltrosOrganizacoes) {
    const where: Prisma.OrganizacaoWhereInput = {
      ...(!filtros.incluirInativas && filtros.ativo === undefined ? { ativo: true } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
      ...(filtros.razaoSocial ? { razaoSocial: { contains: filtros.razaoSocial } } : {}),
      ...(filtros.cnpj ? { cnpj: { contains: filtros.cnpj.replace(/\D/g, "") } } : {}),
    };
    return prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.organizacao.findMany({
          where,
          include: comContrato,
          orderBy: [{ razaoSocial: "asc" }, { id: "asc" }],
          skip: (filtros.page - 1) * filtros.limit,
          take: filtros.limit,
        }),
        tx.organizacao.count({ where }),
      ]);
      return {
        items,
        pagination: {
          page: filtros.page,
          limit: filtros.limit,
          total,
          totalPages: Math.ceil(total / filtros.limit),
        },
      };
    });
  },

  criar(organizacao: DadosNovaOrganizacao, contrato: DadosNovoContrato | undefined, usuario: string) {
    return prisma.$transaction(async (tx) => {
      const criada = await tx.organizacao.create({
        data: { ...organizacao, ...(contrato ? { contrato: { create: contrato } } : {}) },
        include: comContrato,
      });
      await registrarJournal(tx, {
        operacao: "CRIAR",
        entidade: "Organizacao",
        dadosDepois: criada,
        usuario,
      });
      return criada;
    });
  },

  atualizar(
    id: number,
    versao: number,
    dados: { cnpj?: string; enderecoCompleto?: string; ativo?: boolean },
    usuario: string,
  ) {
    return prisma.$transaction(async (tx): Promise<ResultadoEscrita<{ id: number }>> => {
      const antes = await tx.organizacao.findUnique({ where: { id }, include: comContrato });
      if (!antes) return { tipo: "nao_encontrada" };
      const resultado = await tx.organizacao.updateMany({
        where: { id, versao },
        data: { ...dados, versao: { increment: 1 } },
      });
      if (resultado.count === 0) return { tipo: "conflito" };
      const depois = await tx.organizacao.findUniqueOrThrow({ where: { id }, include: comContrato });
      const operacao = dados.ativo === false ? "DESATIVAR_ORGANIZACAO" : "ATUALIZAR_ORGANIZACAO";
      await registrarJournal(tx, {
        operacao,
        entidade: "Organizacao",
        dadosAntes: antes,
        dadosDepois: depois,
        usuario,
      });
      return { tipo: "ok", valor: { id } };
    });
  },

  reativar(id: number, versao: number, agora: Date, usuario: string) {
    return prisma.$transaction(async (tx): Promise<ResultadoEscrita<{ id: number }>> => {
      await tx.$queryRaw`SELECT id FROM Contrato WHERE organizacaoId = ${id} FOR UPDATE`;
      const antes = await tx.organizacao.findUnique({ where: { id }, include: comContrato });
      if (!antes) return { tipo: "nao_encontrada" };
      if (!antes.contrato || antes.contrato.encerradoEm || antes.contrato.dataAssinatura > agora || antes.contrato.dataVencimento < agora) {
        return { tipo: "contrato_invalido" };
      }
      const resultado = await tx.organizacao.updateMany({
        where: { id, versao, ativo: false },
        data: { ativo: true, versao: { increment: 1 } },
      });
      if (resultado.count === 0) {
        const atual = await tx.organizacao.findUnique({ where: { id } });
        if (!atual) return { tipo: "nao_encontrada" };
        if (atual.versao !== versao) return { tipo: "conflito" };
        if (atual.ativo) return { tipo: "ok", valor: { id } };
        return { tipo: "conflito" };
      }
      const depois = await tx.organizacao.findUniqueOrThrow({ where: { id }, include: comContrato });
      await registrarJournal(tx, {
        operacao: "REATIVAR_ORGANIZACAO",
        entidade: "Organizacao",
        dadosAntes: antes,
        dadosDepois: depois,
        usuario,
      });
      return { tipo: "ok", valor: { id } };
    });
  },

  criarContrato(organizacaoId: number, contrato: DadosNovoContrato, usuario: string) {
    return prisma.$transaction(async (tx) => {
      const criado = await tx.contrato.create({ data: { ...contrato, organizacaoId } });
      await registrarJournal(tx, {
        operacao: "CRIAR_CONTRATO",
        entidade: "Contrato",
        dadosDepois: criado,
        usuario,
      });
      return criado;
    });
  },

  renovarContrato(organizacaoId: number, versao: number, novoVencimento: Date, usuario: string) {
    return prisma.$transaction(async (tx): Promise<ResultadoEscrita<{ organizacaoId: number }>> => {
      const antes = await tx.contrato.findUnique({ where: { organizacaoId } });
      if (!antes) return { tipo: "nao_encontrada" };
      if (antes.encerradoEm) return { tipo: "encerrado" };
      const resultado = await tx.contrato.updateMany({
        where: { organizacaoId, versao, encerradoEm: null },
        data: { dataVencimento: novoVencimento, versao: { increment: 1 } },
      });
      if (resultado.count === 0) {
        const atual = await tx.contrato.findUnique({ where: { organizacaoId } });
        if (atual?.encerradoEm) return { tipo: "encerrado" };
        return { tipo: "conflito" };
      }
      const depois = await tx.contrato.findUniqueOrThrow({ where: { organizacaoId } });
      await registrarJournal(tx, {
        operacao: "RENOVAR_CONTRATO",
        entidade: "Contrato",
        dadosAntes: antes,
        dadosDepois: depois,
        usuario,
      });
      return { tipo: "ok", valor: { organizacaoId } };
    });
  },

  encerrarContrato(organizacaoId: number, versao: number, dataEncerramento: Date, motivo: string, retroativo: boolean, usuario: string) {
    return prisma.$transaction(async (tx): Promise<ResultadoEscrita<{ organizacaoId: number }>> => {
      const antes = await tx.contrato.findUnique({ where: { organizacaoId } });
      if (!antes) return { tipo: "nao_encontrada" };
      if (antes.encerradoEm) return { tipo: "encerrado" };
      const resultado = await tx.contrato.updateMany({
        where: { organizacaoId, versao, encerradoEm: null },
        data: { encerradoEm: dataEncerramento, motivoEncerramento: motivo, renovacaoAutomatica: false, versao: { increment: 1 } },
      });
      if (resultado.count === 0) {
        const atual = await tx.contrato.findUnique({ where: { organizacaoId } });
        if (atual?.encerradoEm) return { tipo: "encerrado" };
        return { tipo: "conflito" };
      }
      const depois = await tx.contrato.findUniqueOrThrow({ where: { organizacaoId } });
      await registrarJournal(tx, {
        operacao: retroativo ? "ENCERRAR_CONTRATO_CORRECAO_RETROATIVA" : "ENCERRAR_CONTRATO",
        entidade: "Contrato",
        dadosAntes: antes,
        dadosDepois: depois,
        usuario,
      });
      return { tipo: "ok", valor: { organizacaoId } };
    });
  },
};
