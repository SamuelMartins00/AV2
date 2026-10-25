import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { ErroDominio, ehViolacaoUnica } from "../../dominio/erros.js";
import { authRepository } from "../auth/auth.repository.js";
import { usuariosRepository as repo } from "./usuarios.repository.js";
import type { AtualizarUsuarioBody, CriarUsuarioBody, ListarUsuariosQuery } from "./usuarios.schemas.js";
import { normalizarNomeExibicao, validarPaginacao } from "./usuarios.politica.js";

const MSG_DUPLICADO = "Já existe um usuário com este login.";
const erroRegra = (erro: unknown): never => {
  const codigo = erro instanceof Error ? erro.message : "";
  if (codigo === "ATOR_SEM_PERMISSAO") throw new ErroDominio("Sem permissão para esta ação", 403);
  if (codigo === "ALTERACAO_OUTRO_ADMINISTRADOR_PROIBIDA") throw new ErroDominio("Não é permitido desativar ou alterar o papel de outro administrador", 403);
  if (codigo === "ULTIMO_ADMINISTRADOR") throw new ErroDominio("A operação deixaria o sistema sem administrador ativo", 409);
  if (codigo === "SENHA_ADMIN_INVALIDA") throw new ErroDominio("Senha atual do administrador incorreta ou ausente", 422);
  if (codigo === "REDEFINICAO_PROPRIA_SENHA_PROIBIDA") throw new ErroDominio("Use o endpoint de autoatendimento para alterar sua própria senha", 403);
  if (typeof erro === "object" && erro !== null && "code" in erro && ["P2034", "P2028"].includes(String((erro as { code: unknown }).code))) throw new ErroDominio("Conflito concorrente; tente novamente", 409);
  if (erro instanceof Error && /deadlock|lock wait timeout|ER_LOCK_DEADLOCK|ER_LOCK_WAIT_TIMEOUT/i.test(erro.message)) throw new ErroDominio("Conflito concorrente; tente novamente", 409);
  throw erro;
};

export class UsuariosService {
  async criar(corpo: CriarUsuarioBody, administradorId: number, administrador: string) {
    const usuario = corpo.usuario.trim();
    const nomeExibicao = normalizarNomeExibicao(corpo.nomeExibicao);
    if (await repo.buscarPorNome(usuario)) throw new ErroDominio(MSG_DUPLICADO, 409);
    const hashSenha = await bcrypt.hash(corpo.senha, env.bcryptCusto);
    const ator = await authRepository.buscarUsuarioPorId(administradorId);
    if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new ErroDominio("Sem permissão para esta ação", 403);
    if (corpo.papel === "ADMINISTRADOR" && (!corpo.senhaAtualAdmin || !(await bcrypt.compare(corpo.senhaAtualAdmin, ator.hashSenha)))) throw new ErroDominio("Senha atual do administrador incorreta ou ausente", 422);
    if (corpo.papel !== "ADMINISTRADOR" && corpo.senhaAtualAdmin) throw new ErroDominio("senhaAtualAdmin só é aceita ao criar um administrador", 400);
    try {
      return await repo.criar({ usuario, nomeExibicao, hashSenha, papel: corpo.papel }, administradorId, administrador, corpo.senhaAtualAdmin);
    } catch (erro) {
      if (ehViolacaoUnica(erro)) throw new ErroDominio(MSG_DUPLICADO, 409);
      erroRegra(erro);
    }
  }

  async listar(query: ListarUsuariosQuery) {
    const { page, limit } = validarPaginacao(query.page, query.limit);
    return repo.listar({ page, limit, ...(query.papel ? { papel: query.papel } : {}), ...(query.ativo !== undefined ? { ativo: query.ativo } : {}) });
  }

  async buscar(id: number) {
    const usuario = await repo.buscarPorId(id);
    if (!usuario) throw new ErroDominio("Usuário não encontrado", 404);
    return usuario;
  }

  async atualizar(id: number, corpo: AtualizarUsuarioBody, administradorId: number, administrador: string) {
    const nomeExibicao = corpo.nomeExibicao !== undefined ? normalizarNomeExibicao(corpo.nomeExibicao) : undefined;
    const ator = await authRepository.buscarUsuarioPorId(administradorId);
    if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new ErroDominio("Sem permissão para esta ação", 403);
    const promover = corpo.papel === "ADMINISTRADOR" && (await repo.buscarPorId(id))?.papel !== "ADMINISTRADOR";
    if (corpo.senhaAtualAdmin && !promover) throw new ErroDominio("senhaAtualAdmin só é aceita ao promover uma conta a administrador", 400);
    try {
      const resultado = await repo.atualizar(id, { ...(nomeExibicao !== undefined ? { nomeExibicao } : {}), ...(corpo.papel ? { papel: corpo.papel } : {}) }, corpo.senhaAtualAdmin, administradorId, administrador);
      if (!resultado) throw new ErroDominio("Usuário não encontrado", 404);
      return resultado;
    } catch (erro) { erroRegra(erro); }
  }

  async atualizarMeuNome(id: number, nome: string, ator: string) {
    const nomeExibicao = normalizarNomeExibicao(nome);
    const atualizado = await repo.atualizarMeuNome(id, nomeExibicao, ator);
    if (!atualizado) throw new ErroDominio("Usuário não encontrado ou inativo", 404);
    return atualizado;
  }

  async alterarSituacao(id: number, ativo: boolean, administradorId: number, administrador: string) {
    try {
      const resultado = ativo
        ? await repo.reativar(id, administradorId, administrador)
        : await repo.desativar(id, administradorId, administrador);
      if (!resultado) throw new ErroDominio("Usuário não encontrado", 404);
      return resultado;
    } catch (erro) { erroRegra(erro); }
  }

  async redefinirSenha(id: number, senhaNova: string, administradorId: number, administrador: string) {
    const ator = await authRepository.buscarUsuarioPorId(administradorId);
    if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new ErroDominio("Sem permissão para esta ação", 403);
    if (senhaNova.length < 8 || senhaNova.length > 72) throw new ErroDominio("A senha deve ter entre 8 e 72 caracteres", 422);
    const hashSenha = await bcrypt.hash(senhaNova, env.bcryptCusto);
    try {
      const resultado = await repo.redefinirSenha(id, hashSenha, administradorId, administrador);
      if (!resultado) throw new ErroDominio("Usuário não encontrado", 404);
    } catch (erro) { erroRegra(erro); }
  }
}
