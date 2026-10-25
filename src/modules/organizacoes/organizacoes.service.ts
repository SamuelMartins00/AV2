import {
  contratoEstaVigente,
  lerData,
  validarContrato,
  validarDuracaoRenovacaoMeses,
  validarRenovacao,
} from "../../dominio/contrato.js";
import { ehViolacaoUnica, ErroDominio } from "../../dominio/erros.js";
import { mensagemErroCNPJ, normalizarCNPJ } from "../../dominio/validadores/cnpj.js";
import type {
  AtualizarOrganizacaoBody,
  CriarOrganizacaoBody,
  DadosContratoBody,
  EncerrarContratoBody,
  EncerrarContratoRetroativoBody,
  ListarQuery,
  RenovarContratoBody,
} from "./organizacoes.schemas.js";
import {
  organizacoesRepository as repo,
  type DadosNovoContrato,
} from "./organizacoes.repository.js";

type OrganizacaoComContrato = NonNullable<Awaited<ReturnType<typeof repo.buscarPorId>>>;
type ContratoRegistro = NonNullable<OrganizacaoComContrato["contrato"]>;

const MSG_CONFLITO = "O registro foi alterado por outra requisição. Recarregue e tente novamente.";
const MSG_CNPJ_DUPLICADO = "Já existe uma organização cadastrada com este CNPJ.";

function validarPaginacaoOrganizacoes(pageInformada?: number, limitInformado?: number) {
  const page = pageInformada ?? 1;
  const limit = limitInformado ?? 20;
  if (!Number.isSafeInteger(page) || page < 1) throw new ErroDominio("page deve ser um inteiro positivo", 400);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ErroDominio("limit deve estar entre 1 e 100", 400);
  return { page, limit };
}

function contratoParaResposta(contrato: ContratoRegistro) {
  return {
    id: contrato.id,
    dataAssinatura: contrato.dataAssinatura,
    dataVencimento: contrato.dataVencimento,
    clausulas: contrato.clausulas as string[],
    valorMensal: contrato.valorMensal.toNumber(),
    renovacaoAutomatica: contrato.renovacaoAutomatica,
    duracaoRenovacaoMeses: contrato.duracaoRenovacaoMeses,
    encerradoEm: contrato.encerradoEm,
    motivoEncerramento: contrato.motivoEncerramento,
    versao: contrato.versao,
    vigente: !contrato.encerradoEm && contratoEstaVigente(contrato.dataAssinatura, contrato.dataVencimento),
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
  const assinatura = dados.dataAssinatura ? lerData(dados.dataAssinatura, "Data de assinatura") : new Date();
  const vencimento = lerData(dados.dataVencimento, "Data de vencimento");
  const renovacaoAutomatica = dados.renovacaoAutomatica ?? false;
  if (dados.duracaoRenovacaoMeses !== undefined) validarDuracaoRenovacaoMeses(dados.duracaoRenovacaoMeses);
  if (renovacaoAutomatica && dados.duracaoRenovacaoMeses === undefined) {
    throw new ErroDominio("Informe duracaoRenovacaoMeses para habilitar a renovação automática.", 422);
  }
  validarContrato(assinatura, vencimento, dados.valorMensal);
  return {
    dataAssinatura: assinatura,
    dataVencimento: vencimento,
    clausulas: dados.clausulas ?? [],
    valorMensal: dados.valorMensal,
    renovacaoAutomatica,
    ...(dados.duracaoRenovacaoMeses !== undefined ? { duracaoRenovacaoMeses: dados.duracaoRenovacaoMeses } : {}),
  };
}

function motivoObrigatorio(valor: string): string {
  const motivo = valor.trim();
  if (!motivo) throw new ErroDominio("Informe o motivo da operação.", 422);
  return motivo;
}

export class OrganizacoesService {
  private async obterOuFalhar(id: number): Promise<OrganizacaoComContrato> {
    const org = await repo.buscarPorId(id);
    if (!org) throw new ErroDominio(`Organização ${id} não encontrada.`, 404);
    return org;
  }


  async criar(dados: CriarOrganizacaoBody, usuario: string) {
    const erroCnpj = mensagemErroCNPJ(dados.cnpj);
    if (erroCnpj) throw new ErroDominio(erroCnpj, 400);
    const razaoSocial = dados.razaoSocial.trim();
    const endereco = dados.enderecoCompleto.trim();
    if (!razaoSocial) throw new ErroDominio("A razão social não pode ser vazia.", 422);
    if (!endereco) throw new ErroDominio("O endereço não pode ser vazio.", 422);
    const cnpj = normalizarCNPJ(dados.cnpj);
    if (await repo.buscarPorCnpj(cnpj)) throw new ErroDominio(MSG_CNPJ_DUPLICADO, 409);
    const contrato = dados.contrato ? montarContrato(dados.contrato) : undefined;
    try {
      const criada = await repo.criar({
        razaoSocial, cnpj, inscricaoEstadual: dados.inscricaoEstadual,
        enderecoCompleto: endereco, telefone: dados.telefone, email: dados.email,
      }, contrato, usuario);
      return organizacaoParaResposta(criada);
    } catch (erro) {
      if (ehViolacaoUnica(erro)) throw new ErroDominio(MSG_CNPJ_DUPLICADO, 409);
      throw erro;
    }
  }

  async listar(query: ListarQuery) {
    const { page, limit } = validarPaginacaoOrganizacoes(query.page, query.limit);
    if (query.razaoSocial !== undefined && !query.razaoSocial.trim()) throw new ErroDominio("O filtro razaoSocial não pode ser vazio.", 400);
    const cnpj = query.cnpj === undefined ? undefined : normalizarCNPJ(query.cnpj);
    if (query.cnpj !== undefined && !cnpj) throw new ErroDominio("O filtro CNPJ deve conter ao menos um dígito.", 400);
    const resultado = await repo.listar({
      incluirInativas: query.todas === true,
      page,
      limit,
      ...(query.razaoSocial ? { razaoSocial: query.razaoSocial.trim() } : {}),
      ...(cnpj ? { cnpj } : {}),
      ...(query.ativo !== undefined ? { ativo: query.ativo } : {}),
    });
    return { items: resultado.items.map(organizacaoParaResposta), pagination: resultado.pagination };
  }

  async buscar(id: number) { return organizacaoParaResposta(await this.obterOuFalhar(id)); }

  async atualizar(id: number, corpo: AtualizarOrganizacaoBody, usuario: string) {
    if (corpo.enderecoCompleto === undefined && corpo.desativar === undefined && corpo.cnpj === undefined) {
      throw new ErroDominio("Informe ao menos um campo para alterar.", 400);
    }
    const dados: { cnpj?: string; enderecoCompleto?: string; ativo?: boolean } = {};
    if (corpo.enderecoCompleto !== undefined) {
      const endereco = corpo.enderecoCompleto.trim();
      if (!endereco) throw new ErroDominio("O endereço não pode ser vazio.", 422);
      dados.enderecoCompleto = endereco;
    }
    if (corpo.cnpj !== undefined) {
      const erroCnpj = mensagemErroCNPJ(corpo.cnpj);
      if (erroCnpj) throw new ErroDominio(erroCnpj, 400);
      dados.cnpj = normalizarCNPJ(corpo.cnpj);
    }
    if (corpo.desativar) dados.ativo = false;
    try {
      const resultado = await repo.atualizar(id, corpo.versao, dados, usuario);
      if (resultado.tipo === "nao_encontrada") throw new ErroDominio(`Organização ${id} não encontrada.`, 404);
      if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
      if (resultado.tipo !== "ok") throw new ErroDominio("Não foi possível atualizar a organização.", 409);
      return this.buscar(id);
    } catch (erro) {
      if (ehViolacaoUnica(erro)) throw new ErroDominio(MSG_CNPJ_DUPLICADO, 409);
      throw erro;
    }
  }

  async reativar(id: number, versao: number, usuario: string) {
    const resultado = await repo.reativar(id, versao, new Date(), usuario);
    if (resultado.tipo === "nao_encontrada") throw new ErroDominio(`Organização ${id} não encontrada.`, 404);
    if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
    if (resultado.tipo === "contrato_invalido") throw new ErroDominio("A reativação exige contrato não encerrado e vigente na data da operação.", 422);
    return this.buscar(id);
  }

  async criarContrato(organizacaoId: number, dados: DadosContratoBody, usuario: string) {
    const org = await this.obterOuFalhar(organizacaoId);
    if (org.contrato) throw new ErroDominio("A organização já possui um contrato.", 409);
    const contrato = montarContrato(dados);
    try { await repo.criarContrato(organizacaoId, contrato, usuario); }
    catch (erro) {
      if (ehViolacaoUnica(erro)) throw new ErroDominio("A organização já possui um contrato.", 409);
      throw erro;
    }
    return this.buscar(organizacaoId);
  }

  async renovarContrato(organizacaoId: number, corpo: RenovarContratoBody, usuario: string) {
    const org = await this.obterOuFalhar(organizacaoId);
    if (!org.contrato) throw new ErroDominio("Organização sem contrato.", 422);
    if (org.contrato.encerradoEm) throw new ErroDominio("Não é possível renovar um contrato encerrado.", 409);
    const novoVencimento = lerData(corpo.novoVencimento, "Novo vencimento");
    validarRenovacao(org.contrato.dataVencimento, novoVencimento);
    const resultado = await repo.renovarContrato(organizacaoId, corpo.versao, novoVencimento, usuario);
    if (resultado.tipo === "nao_encontrada") throw new ErroDominio("Organização sem contrato.", 422);
    if (resultado.tipo === "encerrado") throw new ErroDominio("Não é possível renovar um contrato encerrado.", 409);
    if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
    if (resultado.tipo !== "ok") throw new ErroDominio("Não foi possível renovar o contrato.", 409);
    return this.buscar(organizacaoId);
  }

  async encerrarContrato(organizacaoId: number, corpo: EncerrarContratoBody, usuario: string) {
    const org = await this.obterOuFalhar(organizacaoId);
    if (!org.contrato) throw new ErroDominio("Organização sem contrato.", 422);
    const motivo = motivoObrigatorio(corpo.motivo);
    const resultado = await repo.encerrarContrato(organizacaoId, corpo.versao, new Date(), motivo, false, usuario);
    if (resultado.tipo === "nao_encontrada") throw new ErroDominio("Organização sem contrato.", 422);
    if (resultado.tipo === "encerrado") throw new ErroDominio("O contrato já está encerrado.", 409);
    if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
    if (resultado.tipo !== "ok") throw new ErroDominio("Não foi possível encerrar o contrato.", 409);
    return this.buscar(organizacaoId);
  }

  async encerrarContratoRetroativo(organizacaoId: number, corpo: EncerrarContratoRetroativoBody, usuario: string) {
    const org = await this.obterOuFalhar(organizacaoId);
    if (!org.contrato) throw new ErroDominio("Organização sem contrato.", 422);
    const dataEncerramento = lerData(corpo.dataEncerramento, "Data de encerramento");
    if (dataEncerramento.getTime() >= Date.now()) throw new ErroDominio("A correção retroativa exige uma data anterior ao momento atual.", 422);
    if (dataEncerramento < org.contrato.dataAssinatura) throw new ErroDominio("A data de encerramento não pode anteceder a assinatura do contrato.", 422);
    const motivo = motivoObrigatorio(corpo.motivo);
    const resultado = await repo.encerrarContrato(organizacaoId, corpo.versao, dataEncerramento, motivo, true, usuario);
    if (resultado.tipo === "nao_encontrada") throw new ErroDominio("Organização sem contrato.", 422);
    if (resultado.tipo === "encerrado") throw new ErroDominio("O contrato já está encerrado.", 409);
    if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
    if (resultado.tipo !== "ok") throw new ErroDominio("Não foi possível corrigir o encerramento do contrato.", 409);
    return this.buscar(organizacaoId);
  }
}
