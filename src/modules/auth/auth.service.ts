import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { ErroDominio } from "../../dominio/erros.js";
import type { Papel } from "../../dominio/papel.js";
import { authRepository } from "./auth.repository.js";

type AssinarToken = (payload: {
  sub: string;
  usuario: string;
  papel: Papel;
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
  ): ParTokens {
    return {
      accessToken: this.assinar({ sub: String(usuarioId), usuario, papel }),
      refreshToken,
      tipo: "Bearer",
    };
  }

  async login(usuario: string, senha: string): Promise<ParTokens> {
    const registro = await authRepository.buscarUsuarioPorNome(usuario);
    const senhaConfere = await bcrypt.compare(
      senha,
      registro?.hashSenha ?? HASH_FALSO,
    );

    if (!registro || !senhaConfere) {
      throw new ErroDominio("Usuário ou senha inválidos", 401);
    }

    const refreshToken = gerarRefreshToken();
    await authRepository.criarRefreshToken(
      registro.id,
      hashDoToken(refreshToken),
      expiracaoDoRefresh(),
    );
    await authRepository.atualizarUltimoAcesso(registro.id);

    return this.montarPar(registro.id, registro.usuario, registro.papel, refreshToken);
  }

  async renovar(refreshToken: string): Promise<ParTokens> {
    const registro = await authRepository.buscarRefreshToken(
      hashDoToken(refreshToken),
    );

    if (!registro) {
      throw new ErroDominio("Refresh token inválido", 401);
    }

    // Token já usado sendo apresentado de novo: possível roubo.
    // Por segurança, derruba todas as sessões do usuário.
    if (registro.revogado) {
      await authRepository.revogarTodosDoUsuario(registro.usuarioId);
      throw new ErroDominio(
        "Refresh token já utilizado; faça login novamente",
        401,
      );
    }

    if (registro.expiraEm <= new Date()) {
      throw new ErroDominio("Sessão expirada por inatividade", 401);
    }

    const novoToken = gerarRefreshToken();
    const rotacionou = await authRepository.rotacionarRefreshToken(
      registro.id,
      registro.usuarioId,
      hashDoToken(novoToken),
      expiracaoDoRefresh(),
    );

    if (!rotacionou) {
      throw new ErroDominio("Refresh token já utilizado", 401);
    }

    return this.montarPar(
      registro.usuarioId,
      registro.usuario.usuario,
      registro.usuario.papel,
      novoToken,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    await authRepository.revogarRefreshToken(hashDoToken(refreshToken));
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
    await authRepository.atualizarSenhaERevogarTokens(registro.id, hashSenha);
  }

  async perfil(usuarioId: number) {
    const registro = await authRepository.buscarUsuarioPorId(usuarioId);
    if (!registro) {
      throw new ErroDominio("Usuário não encontrado", 401);
    }
    return {
      id: registro.id,
      usuario: registro.usuario,
      papel: registro.papel,
      ultimoAcesso: registro.ultimoAcesso,
    };
  }
}