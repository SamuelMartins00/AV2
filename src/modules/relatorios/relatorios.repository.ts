import { prisma } from "../../config/prisma.js";
import type { StatusRastreamento } from "../../dominio/enums.js";

export const relatoriosRepository = {
  buscarOrganizacao(id: number) {
    return prisma.organizacao.findUnique({
      where: { id },
      select: { id: true, razaoSocial: true, cnpj: true },
    });
  },

  contarLotes(organizacaoId: number, inicio: Date, fim: Date) {
    return prisma.lote.count({
      where: { organizacaoId, dataEntrada: { gte: inicio, lte: fim } },
    });
  },

  // Uma única consulta devolve, por status, a quantidade e o peso somado
  agruparEquipamentosPorStatus(organizacaoId: number, inicio: Date, fim: Date) {
    return prisma.equipamento.groupBy({
      by: ["statusRastreamento"],
      where: {
        lote: { organizacaoId, dataEntrada: { gte: inicio, lte: fim } },
      },
      _count: { _all: true },
      _sum: { pesoQuilogramas: true },
    });
  },

  listarEquipamentosPorStatus(status: StatusRastreamento) {
    return prisma.equipamento.findMany({
      where: { statusRastreamento: status },
      orderBy: { id: "asc" },
      select: {
        id: true,
        codigoBarrasInterno: true,
        marca: true,
        modelo: true,
        loteId: true,
      },
    });
  },

  // Contrato vigente em algum instante do período solicitado. O encerramento
  // antecipado limita a vigência efetiva, sem alterar o vencimento contratual
  listarContratosNoPeriodo(inicio: Date, fim: Date) {
    return prisma.contrato.findMany({
      where: {
        dataAssinatura: { lte: fim },
        dataVencimento: { gte: inicio },
        OR: [
          { encerradoEm: null },
          { encerradoEm: { gte: inicio } },
        ],
      },
      include: { organizacao: { select: { razaoSocial: true, cnpj: true } } },
      orderBy: { organizacaoId: "asc" },
    });
  },

  buscarConfiguracao() {
    return prisma.configuracaoGlobal.findUnique({ where: { id: 1 } });
  },
};
