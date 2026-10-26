import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { ErroDominio } from "../../dominio/erros.js";
import type { Papel } from "../../dominio/papel.js";
import { authRepository } from "./auth.repository.js";
import { registrarEventoSeguranca } from "../auditoria/journal.js";

type AssinarToken = (payload: {
  sub: string;
  usuario: string;
  papel: Papel;
  versaoSeguranca: number;
}) => string;

export interface ParTokens {
  accessToken: string;
  refreshToken: string;
  tipo: "Bearer";
}

// Hash usado quando o usuário não existe, para que o tempo de resposta
// seja parecido e não revele quais usuários estão cadastrados.
const HASH_FALSO = bcrypt.hashSync("senha-falsa", env.bcryptCusto);

const hashDoToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const gerarRefreshToken = () => randomBytes(48).toString("base64url");

const expiracaoDoRefresh = () =>
  new Date(Date.now() + env.refreshTtlMinutos * 60_000);

export class AuthService {
  constructor(private readonly assinar: AssinarToken) { }

  private montarPar(
    usuarioId: number,
    usuario: string,
    papel: Papel,
    refreshToken: string,
    versaoSeguranca: number,
  ): ParTokens {
    return {
      accessToken: this.assinar({ sub: String(usuarioId), usuario, papel, versaoSeguranca }),
      refreshToken,
      tipo: "Bearer",
    };
  }

  private async registrarEvento(
    operacao: string,
    usuario: string,
    dados: Record<string, unknown>,
  ): Promise<void> {
    await registrarEventoSeguranca({
      operacao,
      entidade: "Autenticacao",
      usuario: usuario || "desconhecido",
      dadosDepois: dados,
    });
  }

  async login(usuario: string, senha: string): Promise<ParTokens> {
    const registro = await authRepository.buscarUsuarioPorNome(usuario);
    const senhaConfere = await bcrypt.compare(
      senha,
      registro?.hashSenha ?? HASH_FALSO,
    );

    if (!registro || !senhaConfere || !registro.ativo) {
      await this.registrarEvento("LOGIN_FALHA", registro?.usuario ?? "desconhecido", { resultado: "FALHA" });
      throw new ErroDominio("Usuário ou senha inválidos", 401);
    }

    const refreshToken = gerarRefreshToken();
    const criouSessao = await authRepository.criarSessaoSeAtivo(
      registro.id, registro.versaoSeguranca, hashDoToken(refreshToken), expiracaoDoRefresh(),
    );
    if (!criouSessao) {
      await this.registrarEvento("LOGIN_FALHA", registro?.usuario ?? "desconhecido", { resultado: "FALHA" });
      throw new ErroDominio("Usuário ou senha inválidos", 401);
    }

    await this.registrarEvento("LOGIN_SUCESSO", registro.usuario, { resultado: "SUCESSO" });
    return this.montarPar(registro.id, registro.usuario, registro.papel, refreshToken, registro.versaoSeguranca);
  }

  async renovar(refreshToken: string): Promise<ParTokens> {
    const registro = await authRepository.buscarRefreshToken(
      hashDoToken(refreshToken),
    );

    if (!registro) {
      // Não persistir eventos para tokens opacos desconhecidos: isso permitiria
      // que chamadas anônimas arbitrárias inundassem o journal
      throw new ErroDominio("Refresh token inválido", 401);
    }

    // Token já usado sendo apresentado de novo: possível roubo.
    // Por segurança, derruba todas as sessões do usuário.
    if (registro.revogado) {
      await authRepository.revogarTodosDoUsuario(registro.usuarioId);
      await this.registrarEvento("REFRESH_REUTILIZADO", registro.usuario.usuario, { resultado: "FALHA", motivo: "TOKEN_JA_UTILIZADO" });
      throw new ErroDominio(
        "Refresh token já utilizado; faça login novamente",
        401,
      );
    }

    if (registro.expiraEm <= new Date() || !registro.usuario.ativo || registro.usuario.senhaAlteracaoObrigatoria) {
      await this.registrarEvento("REFRESH_FALHA", registro.usuario.usuario, { resultado: "FALHA", motivo: "SESSAO_INDISPONIVEL" });
      throw new ErroDominio("Sessão expirada ou usuário sem permissão para renovar", 401);
    }

    const novoToken = gerarRefreshToken();
    const rotacionou = await authRepository.rotacionarRefreshToken(
      registro.id, registro.usuarioId, registro.usuario.versaoSeguranca,
      hashDoToken(novoToken), expiracaoDoRefresh(),
    );

    if (!rotacionou) {
      await this.registrarEvento("REFRESH_FALHA", registro.usuario.usuario, { resultado: "FALHA", motivo: "ROTACAO_REJEITADA" });
      throw new ErroDominio("Refresh token já utilizado", 401);
    }

    await this.registrarEvento("REFRESH_ROTACIONADO", registro.usuario.usuario, { resultado: "SUCESSO" });
    return this.montarPar(
      registro.usuarioId,
      registro.usuario.usuario,
      registro.usuario.papel,
      novoToken,
      registro.usuario.versaoSeguranca,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashDoToken(refreshToken);
    const registro = await authRepository.buscarRefreshToken(tokenHash);
    const resultado = await authRepository.revogarRefreshToken(tokenHash);
    if (registro && resultado.count > 0) {
      await this.registrarEvento("LOGOUT_SUCESSO", registro.usuario.usuario, { resultado: "SUCESSO" });
    }
  }

  async alterarSenha(
    usuarioId: number,
    senhaAtual: string,
    senhaNova: string,
  ): Promise<void> {
    const registro = await authRepository.buscarUsuarioPorId(usuarioId);

    if (!registro || !(await bcrypt.compare(senhaAtual, registro.hashSenha))) {
      throw new ErroDominio("Senha atual incorreta", 422);
    }
    if (senhaAtual === senhaNova) {
      throw new ErroDominio("A nova senha deve ser diferente da atual", 422);
    }

    const hashSenha = await bcrypt.hash(senhaNova, env.bcryptCusto);
    const atualizada = await authRepository.atualizarSenhaERevogarTokens(registro.id, hashSenha);
    if (!atualizada) throw new ErroDominio("Conta inativa ou indisponível", 401);
  }

  async perfil(usuarioId: number) {
    const registro = await authRepository.buscarUsuarioPorId(usuarioId);
    if (!registro) {
      throw new ErroDominio("Usuário não encontrado", 401);
    }
    return {
      id: registro.id,
      usuario: registro.usuario,
      nomeExibicao: registro.nomeExibicao,
      papel: registro.papel,
      ativo: registro.ativo,
      ultimoAcesso: registro.ultimoAcesso,
    };
  }
}