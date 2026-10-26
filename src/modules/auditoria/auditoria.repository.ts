import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export interface FiltrosJournal {
  entidade?: string;
  operacao?: string;
  responsavel?: string;
  inicio?: Date;
  fim?: Date;
}

function montarWhere(filtros: FiltrosJournal): Prisma.JournalTransacaoWhereInput {
  return {
    ...(filtros.entidade ? { entidade: { contains: filtros.entidade } } : {}),
    ...(filtros.operacao ? { operacao: { contains: filtros.operacao } } : {}),
    ...(filtros.responsavel
      ? { usuarioResponsavel: { contains: filtros.responsavel } }
      : {}),
    ...(filtros.inicio || filtros.fim
      ? {
          timestamp: {
            ...(filtros.inicio ? { gte: filtros.inicio } : {}),
            ...(filtros.fim ? { lte: filtros.fim } : {}),
          },
        }
      : {}),
  };
}

export const auditoriaRepository = {
  async listar(filtros: FiltrosJournal, pagina: number, limite: number) {
    const where = montarWhere(filtros);
    const [total, registros] = await Promise.all([
      prisma.journalTransacao.count({ where }),
      prisma.journalTransacao.findMany({
        where,
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          timestamp: true,
          operacao: true,
          entidade: true,
          dadosAntes: true,
          dadosDepois: true,
          usuarioResponsavel: true,
        },
      }),
    ]);
    return { total, registros };
  },
};
