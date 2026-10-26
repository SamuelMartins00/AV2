import { lerData } from "../../dominio/contrato.js";
import { ErroDominio } from "../../dominio/erros.js";
import { comTentativas } from "../../dominio/tentativas.js";
import { lerFimDoDia } from "../../dominio/periodo.js";
import { mensagemErroDataEntrada } from "../../dominio/validadores/data-entrada.js";
import { MSG_CONFLITO } from "../compartilhado/params.js";
import { equipamentoParaResposta } from "../equipamentos/equipamentos.mapper.js";
import {
  lotesRepository as repo,
  type DadosNovoEquipamento,
  type LoteCompleto,
  type ResultadoLote,
} from "./lotes.repository.js";
import type {
  AdicionarEquipamentosBody,
  CriarLoteBody,
  DadosEquipamentoBody,
  ListarLotesQuery,
  TriagemBody,
} from "./lotes.schemas.js";

type LoteResumo = Awaited<ReturnType<typeof repo.listarPorPeriodo>>[number];

function somarPesos(pesos: { toNumber(): number }[]): number {
  const total = pesos.reduce((soma, peso) => soma + peso.toNumber(), 0);
  return Number(total.toFixed(3));
}

function loteParaResposta(lote: LoteCompleto) {
  return {
    id: lote.id,
    organizacaoId: lote.organizacaoId,
    dataEntrada: lote.dataEntrada,
    notaFiscal: lote.notaFiscal,
    transportadora: lote.transportadora,
    statusProcessamento: lote.statusProcessamento,
    observacoes: lote.observacoes,
    versao: lote.versao,
    quantidadeEquipamentos: lote.equipamentos.length,
    pesoTotalKg: somarPesos(lote.equipamentos.map((e) => e.pesoQuilogramas)),
    equipamentos: lote.equipamentos.map(equipamentoParaResposta),
  };
}

function resumoParaResposta(lote: LoteResumo) {
  return {
    id: lote.id,
    organizacaoId: lote.organizacaoId,
    dataEntrada: lote.dataEntrada,
    notaFiscal: lote.notaFiscal,
    transportadora: lote.transportadora,
    statusProcessamento: lote.statusProcessamento,
    observacoes: lote.observacoes,
    versao: lote.versao,
    quantidadeEquipamentos: lote.equipamentos.length,
    pesoTotalKg: somarPesos(lote.equipamentos.map((e) => e.pesoQuilogramas)),
  };
}

function lerEquipamentos(itens: DadosEquipamentoBody[]): DadosNovoEquipamento[] {
  return itens.map((item) => {
    const marca = item.marca.trim();
    const modelo = item.modelo.trim();
    if (!marca || !modelo) {
      throw new ErroDominio("Marca e modelo do equipamento são obrigatórios.", 422);
    }
    return {
      tipo: item.tipo,
      marca,
      modelo,
      anoFabricacao: item.anoFabricacao,
      estadoFisico: item.estadoFisico,
      pesoQuilogramas: item.pesoQuilogramas,
    };
  });
}

function lerResultado<T>(resultado: ResultadoLote<T>, id: number): T {
  switch (resultado.tipo) {
    case "ok":
      return resultado.valor;
    case "nao_encontrada":
      throw new ErroDominio(`Lote ${id} não encontrado.`, 404);
    case "conflito":
      throw new ErroDominio(MSG_CONFLITO, 409);
    case "status_invalido":
      throw new ErroDominio(
        "A triagem deste lote já foi concluída; a operação não é permitida.",
        422,
      );
    case "sem_equipamentos":
      throw new ErroDominio(
        "Não é possível concluir a triagem de um lote sem equipamentos.",
        422,
      );
    case "triagem_incompleta":
      throw new ErroDominio(
        "Não é possível concluir a triagem: todos os equipamentos precisam de resultado, responsável, data e justificativa.",
        422,
      );
  }
}

export class LotesService {
  async criar(corpo: CriarLoteBody, usuario: string) {
    const dataEntrada = lerData(corpo.dataEntrada, "Data de entrada");
    const erroData = mensagemErroDataEntrada(dataEntrada);
    if (erroData) throw new ErroDominio(erroData, 422);

    const notaFiscal = corpo.notaFiscal.trim();
    const transportadora = corpo.transportadora.trim();
    if (!notaFiscal || !transportadora) {
      throw new ErroDominio("Nota fiscal e transportadora são obrigatórias.", 422);
    }

    if (!(await repo.organizacaoExiste(corpo.organizacaoId))) {
      throw new ErroDominio(`Organização ${corpo.organizacaoId} não encontrada.`, 404);
    }

    const equipamentos = lerEquipamentos(corpo.equipamentos ?? []);

    const lote = await comTentativas(() =>
      repo.criar(
        {
          organizacaoId: corpo.organizacaoId,
          dataEntrada,
          notaFiscal,
          transportadora,
          observacoes: corpo.observacoes?.trim() || undefined,
        },
        equipamentos,
        usuario,
      ),
    );
    return loteParaResposta(lote);
  }

  async listar(consulta: ListarLotesQuery) {
    const inicio = consulta.inicio ? lerData(consulta.inicio, "Data inicial") : undefined;
    const fim = consulta.fim ? lerFimDoDia(consulta.fim, "Data final") : undefined;

    if (inicio && fim && inicio > fim) {
      throw new ErroDominio("A data inicial não pode ser posterior à data final.", 422);
    }

    const lotes = await repo.listarPorPeriodo(inicio, fim, consulta);
    return lotes.map(resumoParaResposta);
  }

  async buscar(id: number) {
    const lote = await repo.buscarPorId(id);
    if (!lote) throw new ErroDominio(`Lote ${id} não encontrado.`, 404);
    return loteParaResposta(lote);
  }

  async adicionarEquipamentos(
    id: number,
    corpo: AdicionarEquipamentosBody,
    usuario: string,
  ) {
    const itens = lerEquipamentos(corpo.equipamentos);
    const resultado = await comTentativas(() =>
      repo.adicionarEquipamentos(id, itens, usuario),
    );
    return loteParaResposta(lerResultado(resultado, id));
  }

  async concluirTriagem(id: number, corpo: TriagemBody, usuario: string) {
    const resultado = await repo.concluirTriagem(id, corpo.versao, usuario);
    return loteParaResposta(lerResultado(resultado, id));
  }
}
