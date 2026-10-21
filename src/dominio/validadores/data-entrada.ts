/** Devolve a mensagem de erro, ou null quando a data de entrada é válida. */
export function mensagemErroDataEntrada(
  data: Date,
  agora: Date = new Date(),
): string | null {
  if (Number.isNaN(data.getTime())) {
    return "A data de entrada informada é inválida.";
  }
  if (data > agora) {
    return "A data de entrada não pode ser futura.";
  }

  const limite = new Date(agora);
  limite.setDate(limite.getDate() - 90);
  if (data < limite) {
    return "A data de entrada não pode ser anterior a 90 dias.";
  }
  return null;
}
