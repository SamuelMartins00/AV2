import { ErroDominio } from "../../dominio/erros.js";
import { validarParametros } from "../../dominio/parametros.js";
import { configuracaoRepository as repo } from "./configuracao.repository.js";
import type { AtualizarConfiguracaoBody } from "./configuracao.schemas.js";

type Configuracao = Awaited<ReturnType<typeof repo.obter>>;

function paraResposta(config: Configuracao) {
  const aliquota = config.aliquotaImpostos.toNumber();
  return {
    aliquotaImpostos: aliquota,
    aliquotaPercentual: Number((aliquota * 100).toFixed(2)),
    coeficienteDepreciacao: config.coeficienteDepreciacao.toNumber(),
    valorBaseDepreciacao: config.valorBaseDepreciacao.toNumber(),
  };
}

export class ConfiguracaoService {
  async obter() {
    return paraResposta(await repo.obter());
  }

  async atualizar(corpo: AtualizarConfiguracaoBody, usuario: string) {
    if (
      corpo.aliquotaImpostos === undefined &&
      corpo.coeficienteDepreciacao === undefined &&
      corpo.valorBaseDepreciacao === undefined
    ) {
      throw new ErroDominio("Informe ao menos um parâmetro para alterar.", 400);
    }

    validarParametros(corpo);

    return paraResposta(await repo.atualizar(corpo, usuario));
  }
}
