import {
  contratoEstaVigente,
  lerData,
  validarContrato,
  validarRenovacao,
} from "../../dominio/contrato.js";
import { ehViolacaoUnica, ErroDominio } from "../../dominio/erros.js";
import {
  mensagemErroCNPJ,
  normalizarCNPJ,
} from "../../dominio/validadores/cnpj.js";
import type {
  AtualizarOrganizacaoBody,
  CriarOrganizacaoBody,
  DadosContratoBody,
  RenovarContratoBody,
} from "./organizacoes.schemas.js";
import {
  organizacoesRepository as repo,
  type DadosNovoContrato,
} from "./organizacoes.repository.js";

type OrganizacaoComContrato = NonNullable<
  Awaited<ReturnType<typeof repo.buscarPorId>>
>;
type ContratoRegistro = NonNullable<OrganizacaoComContrato["contrato"]>;

const MSG_CONFLITO =
  "O registro foi alterado por outra requisição. Recarregue e tente novamente.";
const MSG_CNPJ_DUPLICADO =
  "Já existe uma organização cadastrada com este CNPJ.";

function contratoParaResposta(contrato: ContratoRegistro) {
  return {
    id: contrato.id,
    dataAssinatura: contrato.dataAssinatura,
    dataVencimento: contrato.dataVencimento,
    clausulas: contrato.clausulas as string[],
    valorMensal: contrato.valorMensal.toNumber(),
    renovacaoAutomatica: contrato.renovacaoAutomatica,
    versao: contrato.versao,
    vigente: contratoEstaVigente(
      contrato.dataAssinatura,
      contrato.dataVencimento,
    ),
  };
}

function organizacaoParaResposta(org: OrganizacaoComContrato) {
  return {
    id: org.id,
    razaoSocial: org.razaoSocial,
    cnpj: org.cnpj,
    inscricaoEstadual: org.inscricaoEstadual,
    enderecoCompleto: org.enderecoCompleto,
    telefone: org.telefone,
    email: org.email,
    dataCadastro: org.dataCadastro,
    ativo: org.ativo,
    versao: org.versao,
    contrato: org.contrato ? contratoParaResposta(org.contrato) : null,
  };
}

function montarContrato(dados: DadosContratoBody): DadosNovoContrato {
  const assinatura = dados.dataAssinatura
    ? lerData(dados.dataAssinatura, "Data de assinatura")
    : new Date();
  const vencimento = lerData(dados.dataVencimento, "Data de vencimento");

  validarContrato(assinatura, vencimento, dados.valorMensal);

  return {
    dataAssinatura: assinatura,
    dataVencimento: vencimento,
    clausulas: dados.clausulas ?? [],
    valorMensal: dados.valorMensal,
    renovacaoAutomatica: dados.renovacaoAutomatica ?? false,
  };
}

export class OrganizacoesService {
  private async obterOuFalhar(id: number): Promise<OrganizacaoComContrato> {
    const org = await repo.buscarPorId(id);
    if (!org) {
      throw new ErroDominio(`Organização ${id} não encontrada.`, 404);
    }
    return org;
  }

  async criar(dados: CriarOrganizacaoBody, usuario: string) {
    const erroCnpj = mensagemErroCNPJ(dados.cnpj);
    if (erroCnpj) throw new ErroDominio(erroCnpj, 400);

    const razaoSocial = dados.razaoSocial.trim();
    const endereco = dados.enderecoCompleto.trim();
    if (!razaoSocial) {
      throw new ErroDominio("A razão social não pode ser vazia.", 422);
    }
    if (!endereco) {
      throw new ErroDominio("O endereço não pode ser vazio.", 422);
    }

    const cnpj = normalizarCNPJ(dados.cnpj);
    if (await repo.buscarPorCnpj(cnpj)) {
      throw new ErroDominio(MSG_CNPJ_DUPLICADO, 409);
    }

    const contrato = dados.contrato ? montarContrato(dados.contrato) : undefined;

    try {
      const criada = await repo.criar(
        {
          razaoSocial,
          cnpj,
          inscricaoEstadual: dados.inscricaoEstadual,
          enderecoCompleto: endereco,
          telefone: dados.telefone,
          email: dados.email,
        },
        contrato,
        usuario,
      );
      return organizacaoParaResposta(criada);
    } catch (erro) {
      // Duas requisições simultâneas com o mesmo CNPJ: o UNIQUE do banco decide
      if (ehViolacaoUnica(erro)) {
        throw new ErroDominio(MSG_CNPJ_DUPLICADO, 409);
      }
      throw erro;
    }
  }

  async listar(incluirInativas: boolean) {
    const lista = await repo.listar(incluirInativas);
    return lista.map(organizacaoParaResposta);
  }

  async buscar(id: number) {
    return organizacaoParaResposta(await this.obterOuFalhar(id));
  }

  async atualizar(id: number, corpo: AtualizarOrganizacaoBody, usuario: string) {
    if (corpo.enderecoCompleto === undefined && corpo.desativar === undefined) {
      throw new ErroDominio("Informe ao menos um campo para alterar.", 400);
    }

    const dados: { enderecoCompleto?: string; ativo?: boolean } = {};

    if (corpo.enderecoCompleto !== undefined) {
      const endereco = corpo.enderecoCompleto.trim();
      if (!endereco) {
        throw new ErroDominio("O endereço não pode ser vazio.", 422);
      }
      dados.enderecoCompleto = endereco;
    }
    if (corpo.desativar) {
      dados.ativo = false;
    }

    const resultado = await repo.atualizar(id, corpo.versao, dados, usuario);

    if (resultado.tipo === "nao_encontrada") {
      throw new ErroDominio(`Organização ${id} não encontrada.`, 404);
    }
    if (resultado.tipo === "conflito") {
      throw new ErroDominio(MSG_CONFLITO, 409);
    }
    return this.buscar(id);
  }

  async criarContrato(
    organizacaoId: number,
    dados: DadosContratoBody,
    usuario: string,
  ) {
    const org = await this.obterOuFalhar(organizacaoId);
    if (org.contrato) {
      throw new ErroDominio("A organização já possui um contrato.", 409);
    }

    const contrato = montarContrato(dados);

    try {
      await repo.criarContrato(organizacaoId, contrato, usuario);
    } catch (erro) {
      if (ehViolacaoUnica(erro)) {
        throw new ErroDominio("A organização já possui um contrato.", 409);
      }
      throw erro;
    }
    return this.buscar(organizacaoId);
  }

  async renovarContrato(
    organizacaoId: number,
    corpo: RenovarContratoBody,
    usuario: string,
  ) {
    const org = await this.obterOuFalhar(organizacaoId);
    if (!org.contrato) {
      throw new ErroDominio("Organização sem contrato vigente.", 422);
    }

    const novoVencimento = lerData(corpo.novoVencimento, "Novo vencimento");
    validarRenovacao(org.contrato.dataVencimento, novoVencimento);

    const resultado = await repo.renovarContrato(
      organizacaoId,
      corpo.versao,
      novoVencimento,
      usuario,
    );

    if (resultado.tipo === "nao_encontrada") {
      throw new ErroDominio("Organização sem contrato vigente.", 422);
    }
    if (resultado.tipo === "conflito") {
      throw new ErroDominio(MSG_CONFLITO, 409);
    }
    return this.buscar(organizacaoId);
  }
}