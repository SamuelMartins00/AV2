import { ehViolacaoUnica, ErroDominio } from "./erros.js";

/**
 * Repete a operação quando duas requisições simultâneas geram o mesmo
 * identificador (violação de UNIQUE). Ao esgotar as tentativas, devolve 409.
 */
export async function comTentativas<T>(
  operacao: () => Promise<T>,
  maximo = 3,
): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await operacao();
    } catch (erro) {
      if (!ehViolacaoUnica(erro)) throw erro;
      if (tentativa >= maximo) {
        throw new ErroDominio(
          "Conflito ao gerar identificadores. Tente novamente.",
          409,
        );
      }
    }
  }
}
