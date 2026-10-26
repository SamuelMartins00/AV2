import { prisma } from "../../config/prisma.js";
import { validarMovimentacao, validarMudancaEstado, validarMudancaStatus } from "../../dominio/equipamento.js";
import { ErroDominio } from "../../dominio/erros.js";
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

  listar(filtros: {
    loteId?: number;
    codigoBarrasInterno?: string;
    statusRastreamento?: StatusRastreamento;
    resultadoTriagem?: import("../../dominio/enums.js").ResultadoTriagem;
    tipo?: import("../../dominio/enums.js").TipoEquipamento;
  }) {
    return prisma.equipamento.findMany({
      where: {
        loteId: filtros.loteId,
        codigoBarrasInterno: filtros.codigoBarrasInterno ? { contains: filtros.codigoBarrasInterno } : undefined,
        statusRastreamento: filtros.statusRastreamento,
        resultadoTriagem: filtros.resultadoTriagem,
        tipo: filtros.tipo,
      },
      orderBy: [{ loteId: "desc" }, { posicaoNoLote: "asc" }],
    });
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
        if (antes.versao !== versao) return { tipo: "conflito" };
        if (antes.statusRastreamento === "BAIXA_DEFINITIVA") {
          throw new ErroDominio("Não é possível alterar o estado físico de equipamento baixado definitivamente.", 409);
        }
        validarMudancaEstado(antes.estadoFisico, novoEstado, justificativa);

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
        if (antes.versao !== versao) return { tipo: "conflito" };
        validarMudancaStatus(antes.statusRastreamento, novoStatus, justificativa, antes.resultadoTriagem);

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
      // A atualização condicional serializa as operações concorrentes na linha.
      const travado = await tx.equipamento.updateMany({
        where: { id: equipamentoId },
        data: { versao: { increment: 1 } },
      });
      if (travado.count === 0) return { tipo: "nao_encontrada" as const };
      const equipamento = await tx.equipamento.findUniqueOrThrow({ where: { id: equipamentoId } });
      if (["BAIXA_DEFINITIVA", "PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO"].includes(equipamento.statusRastreamento)) {
        throw new ErroDominio("Não é possível movimentar equipamento com operação encerrada.", 409);
      }
      validarMovimentacao(destino, usuario, equipamento.statusRastreamento, equipamento.resultadoTriagem);
      const ultima = await tx.movimentacao.findFirst({
        where: { equipamentoId },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
      });
      const criada = await tx.movimentacao.create({
        data: { equipamentoId, origem: ultima?.destino ?? "Entrada", destino, responsavel: usuario, observacao },
      });
      await registrarJournal(tx, {
        operacao: "REGISTRAR_MOVIMENTACAO",
        entidade: "Equipamento",
        dadosAntes: equipamento,
        dadosDepois: criada,
        usuario,
      });
      return { tipo: "ok" as const, valor: criada };
    });
  },

  baixarDefinitivamente(
    id: number,
    versao: number,
    justificativa: string,
    usuario: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.equipamento.findUnique({ where: { id } });
      if (!antes) return { tipo: "nao_encontrada" as const };
      if (antes.versao !== versao) return { tipo: "conflito" as const };
      if (antes.statusRastreamento === "BAIXA_DEFINITIVA") return { tipo: "status_invalido" as const };
      if (!["PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO"].includes(antes.statusRastreamento)) {
        throw new ErroDominio("A baixa definitiva exige conclusão registrada da operação de reaproveitamento, reciclagem ou descarte seguro.", 409);
      }
      const atualizada = await tx.equipamento.updateMany({
        where: { id, versao, statusRastreamento: { not: "BAIXA_DEFINITIVA" } },
        data: {
          statusRastreamento: "BAIXA_DEFINITIVA",
          baixadoEm: new Date(),
          baixaResponsavel: usuario,
          baixaJustificativa: justificativa,
          versao: { increment: 1 },
        },
      });
      if (!atualizada.count) return { tipo: "conflito" as const };
      const depois = await tx.equipamento.findUniqueOrThrow({ where: { id } });
      await registrarJournal(tx, {
        operacao: "BAIXA_DEFINITIVA_EQUIPAMENTO",
        entidade: "Equipamento",
        dadosAntes: antes,
        dadosDepois: depois,
        usuario,
      });
      return { tipo: "ok" as const, valor: depois };
    });
  },
};
