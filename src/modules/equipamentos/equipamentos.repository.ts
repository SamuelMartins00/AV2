import { prisma } from "../../config/prisma.js";
import type {
  EstadoFisico,
  StatusRastreamento,
} from "../../dominio/enums.js";
import { registrarJournal } from "../auditoria/journal.js";
import type { ResultadoEscrita } from "../compartilhado/params.js";

export const equipamentosRepository = {
  buscarPorId(id: number) {
    return prisma.equipamento.findUnique({ where: { id } });
  },

  buscarComHistorico(id: number) {
    return prisma.equipamento.findUnique({
      where: { id },
      include: {
        movimentacoes: { orderBy: [{ dataHora: "asc" }, { id: "asc" }] },
      },
    });
  },

  buscarConfiguracao() {
    return prisma.configuracaoGlobal.findUnique({ where: { id: 1 } });
  },

  atualizarEstado(
    id: number,
    versao: number,
    novoEstado: EstadoFisico,
    justificativa: string,
    usuario: string,
  ) {
    return prisma.$transaction(
      async (tx): Promise<ResultadoEscrita<null>> => {
        const antes = await tx.equipamento.findUnique({ where: { id } });
        if (!antes) return { tipo: "nao_encontrada" };

        const resultado = await tx.equipamento.updateMany({
          where: { id, versao },
          data: { estadoFisico: novoEstado, versao: { increment: 1 } },
        });
        if (resultado.count === 0) return { tipo: "conflito" };

        const depois = await tx.equipamento.findUniqueOrThrow({
          where: { id },
        });

        await registrarJournal(tx, {
          operacao: "ATUALIZAR_ESTADO_FISICO",
          entidade: "Equipamento",
          dadosAntes: antes,
          dadosDepois: { ...depois, justificativa },
          usuario,
        });

        return { tipo: "ok", valor: null };
      },
    );
  },

  atualizarStatus(
    id: number,
    versao: number,
    novoStatus: StatusRastreamento,
    justificativa: string,
    usuario: string,
  ) {
    return prisma.$transaction(
      async (tx): Promise<ResultadoEscrita<null>> => {
        const antes = await tx.equipamento.findUnique({ where: { id } });
        if (!antes) return { tipo: "nao_encontrada" };

        const resultado = await tx.equipamento.updateMany({
          where: { id, versao },
          data: { statusRastreamento: novoStatus, versao: { increment: 1 } },
        });
        if (resultado.count === 0) return { tipo: "conflito" };

        const depois = await tx.equipamento.findUniqueOrThrow({
          where: { id },
        });

        await registrarJournal(tx, {
          operacao: "ATUALIZAR_STATUS",
          entidade: "Equipamento",
          dadosAntes: antes,
          dadosDepois: { ...depois, justificativa },
          usuario,
        });

        return { tipo: "ok", valor: null };
      },
    );
  },

  registrarMovimentacao(
    equipamentoId: number,
    destino: string,
    observacao: string | undefined,
    usuario: string,
  ) {
    return prisma.$transaction(async (tx) => {
      // Incrementar a versão trava a linha do equipamento: duas movimentações
      // simultâneas são executadas uma depois da outra, e a origem fica correta.
      const travado = await tx.equipamento.updateMany({
        where: { id: equipamentoId },
        data: { versao: { increment: 1 } },
      });
      if (travado.count === 0) return null;

      const ultima = await tx.movimentacao.findFirst({
        where: { equipamentoId },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
      });

      const criada = await tx.movimentacao.create({
        data: {
          equipamentoId,
          origem: ultima?.destino ?? "Entrada",
          destino,
          responsavel: usuario,
          observacao,
        },
      });

      await registrarJournal(tx, {
        operacao: "REGISTRAR_MOVIMENTACAO",
        entidade: "Equipamento",
        dadosDepois: criada,
        usuario,
      });

      return criada;
    });
  },
};
