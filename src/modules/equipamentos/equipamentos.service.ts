import {
  calcularDepreciacao,
  validarMovimentacao,
  validarMudancaEstado,
  validarMudancaStatus,
} from "../../dominio/equipamento.js";
import { ErroDominio } from "../../dominio/erros.js";
import { MSG_CONFLITO, type ResultadoEscrita } from "../compartilhado/params.js";
import {
  equipamentoParaResposta,
  movimentacaoParaResposta,
} from "./equipamentos.mapper.js";
import { equipamentosRepository as repo } from "./equipamentos.repository.js";
import type {
  AtualizarEstadoBody,
  AtualizarStatusBody,
  MovimentarBody,
} from "./equipamentos.schemas.js";

function naoEncontrado(id: number): ErroDominio {
  return new ErroDominio(`Equipamento ${id} não encontrado.`, 404);
}

function exigirOk(id: number, resultado: ResultadoEscrita<null>): void {
  if (resultado.tipo === "nao_encontrada") throw naoEncontrado(id);
  if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
}

export class EquipamentosService {
  private async obterOuFalhar(id: number) {
    const eq = await repo.buscarPorId(id);
    if (!eq) throw naoEncontrado(id);
    return eq;
  }

  async rastrear(id: number) {
    const eq = await repo.buscarComHistorico(id);
    if (!eq) throw naoEncontrado(id);

    const { movimentacoes, ...equipamento } = eq;
    return {
      equipamento: equipamentoParaResposta(equipamento),
      movimentacoes: movimentacoes.map(movimentacaoParaResposta),
    };
  }

  async atualizarEstado(
    id: number,
    corpo: AtualizarEstadoBody,
    usuario: string,
  ) {
    const eq = await this.obterOuFalhar(id);
    const justificativa = (corpo.justificativa ?? "").trim();

    validarMudancaEstado(eq.estadoFisico, corpo.novoEstado, justificativa);

    exigirOk(
      id,
      await repo.atualizarEstado(
        id,
        corpo.versao,
        corpo.novoEstado,
        justificativa,
        usuario,
      ),
    );
    return equipamentoParaResposta(await this.obterOuFalhar(id));
  }

  async atualizarStatus(
    id: number,
    corpo: AtualizarStatusBody,
    usuario: string,
  ) {
    const eq = await this.obterOuFalhar(id);
    const justificativa = corpo.justificativa.trim();

    validarMudancaStatus(eq.statusRastreamento, corpo.novoStatus, justificativa);

    exigirOk(
      id,
      await repo.atualizarStatus(
        id,
        corpo.versao,
        corpo.novoStatus,
        justificativa,
        usuario,
      ),
    );
    return equipamentoParaResposta(await this.obterOuFalhar(id));
  }

  async movimentar(id: number, corpo: MovimentarBody, usuario: string) {
    const eq = await this.obterOuFalhar(id);

    validarMovimentacao(corpo.destino, usuario, eq.statusRastreamento);

    const criada = await repo.registrarMovimentacao(
      id,
      corpo.destino.trim(),
      corpo.observacao?.trim() || undefined,
      usuario,
    );
    if (!criada) throw naoEncontrado(id);

    return movimentacaoParaResposta(criada);
  }

  async depreciacao(id: number) {
    const eq = await this.obterOuFalhar(id);

    const config = await repo.buscarConfiguracao();
    if (!config) {
      throw new ErroDominio("Os parâmetros globais não foram configurados.", 422);
    }

    const coeficiente = config.coeficienteDepreciacao.toNumber();
    const valorBase = config.valorBaseDepreciacao.toNumber();

    return {
      equipamentoId: eq.id,
      depreciacaoAcumulada: calcularDepreciacao({
        coeficiente,
        valorBase,
        anoFabricacao: eq.anoFabricacao,
        estado: eq.estadoFisico,
      }),
      coeficiente,
      valorBase,
    };
  }
}
