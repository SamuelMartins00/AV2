import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { ehViolacaoUnica, ErroDominio } from "../../dominio/erros.js";
import { usuariosRepository as repo } from "./usuarios.repository.js";
import type { CriarUsuarioBody } from "./usuarios.schemas.js";

const MSG_DUPLICADO = "Já existe um usuário com este nome.";

export class UsuariosService {
  async criar(corpo: CriarUsuarioBody, administrador: string) {
    const nome = corpo.usuario.trim();

    if (await repo.buscarPorNome(nome)) {
      throw new ErroDominio(MSG_DUPLICADO, 409);
    }

    const hashSenha = await bcrypt.hash(corpo.senha, env.bcryptCusto);

    try {
      return await repo.criar(nome, hashSenha, corpo.papel, administrador);
    } catch (erro) {
      // Duas criações simultâneas do mesmo nome: o UNIQUE do banco decide
      if (ehViolacaoUnica(erro)) {
        throw new ErroDominio(MSG_DUPLICADO, 409);
      }
      throw erro;
    }
  }

  listar() {
    return repo.listar();
  }
}
