const PESOS_PRIMEIRO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizarCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function calcularDigito(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += (base.charCodeAt(i) - 48) * (pesos[i] ?? 0);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Devolve a mensagem de erro, ou null quando o CNPJ é válido. */
export function mensagemErroCNPJ(cnpj: string): string | null {
  const limpo = normalizarCNPJ(cnpj);

  if (limpo.length !== 14) {
    return "O CNPJ deve possuir 14 dígitos.";
  }
  if (/^(\d)\1{13}$/.test(limpo)) {
    return "O CNPJ informado é inválido.";
  }

  const base = limpo.slice(0, 12);
  const primeiro = calcularDigito(base, PESOS_PRIMEIRO);
  const segundo = calcularDigito(base + primeiro, PESOS_SEGUNDO);

  if (limpo !== base + primeiro + segundo) {
    return "Os dígitos verificadores do CNPJ são inválidos.";
  }
  return null;
}