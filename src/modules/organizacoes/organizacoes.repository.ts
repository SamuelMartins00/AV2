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
}

export type ResultadoEscrita<T> =
  | { tipo: "ok"; valor: T }
  | { tipo: "conflito" }
  | { tipo: "nao_encontrada" };

export const organizacoesRepository = {
  buscarPorId(id: number) {
    return prisma.organizacao.findUnique({
      where: { id },
      include: comContrato,
    });
  },

  buscarPorCnpj(cnpj: string) {
    return prisma.organizacao.findUnique({ where: { cnpj } });
  },

  listar(incluirInativas: boolean) {
    return prisma.organizacao.findMany({
      where: incluirInativas ? {} : { ativo: true },
      include: comContrato,
      orderBy: { razaoSocial: "asc" },
    });
  },

  criar(
    organizacao: DadosNovaOrganizacao,
    contrato: DadosNovoContrato | undefined,
    usuario: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const criada = await tx.organizacao.create({
        data: {
          ...organizacao,
          ...(contrato ? { contrato: { create: contrato } } : {}),
        },
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
    dados: { enderecoCompleto?: string; ativo?: boolean },
    usuario: string,
  ) {
    return prisma.$transaction(
      async (tx): Promise<ResultadoEscrita<{ id: number }>> => {
        const antes = await tx.organizacao.findUnique({
          where: { id },
          include: comContrato,
        });
        if (!antes) return { tipo: "nao_encontrada" };

        const resultado = await tx.organizacao.updateMany({
          where: { id, versao },
          data: { ...dados, versao: { increment: 1 } },
        });
        if (resultado.count === 0) return { tipo: "conflito" };

        const depois = await tx.organizacao.findUniqueOrThrow({
          where: { id },
          include: comContrato,
        });

        await registrarJournal(tx, {
          operacao: "ATUALIZAR",
          entidade: "Organizacao",
          dadosAntes: antes,
          dadosDepois: depois,
          usuario,
        });

        return { tipo: "ok", valor: { id } };
      },
    );
  },

  criarContrato(
    organizacaoId: number,
    contrato: DadosNovoContrato,
    usuario: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const criado = await tx.contrato.create({
        data: { ...contrato, organizacaoId },
      });

      await registrarJournal(tx, {
        operacao: "CRIAR_CONTRATO",
        entidade: "Contrato",
        dadosDepois: criado,
        usuario,
      });

      return criado;
    });
  },

  renovarContrato(
    organizacaoId: number,
    versao: number,
    novoVencimento: Date,
    usuario: string,
  ) {
    return prisma.$transaction(
      async (tx): Promise<ResultadoEscrita<{ organizacaoId: number }>> => {
        const antes = await tx.contrato.findUnique({
          where: { organizacaoId },
        });
        if (!antes) return { tipo: "nao_encontrada" };

        const resultado = await tx.contrato.updateMany({
          where: { organizacaoId, versao },
          data: { dataVencimento: novoVencimento, versao: { increment: 1 } },
        });
        if (resultado.count === 0) return { tipo: "conflito" };

        const depois = await tx.contrato.findUniqueOrThrow({
          where: { organizacaoId },
        });

        await registrarJournal(tx, {
          operacao: "RENOVAR_CONTRATO",
          entidade: "Contrato",
          dadosAntes: antes,
          dadosDepois: depois,
          usuario,
        });

        return { tipo: "ok", valor: { organizacaoId } };
      },
    );
  },
};