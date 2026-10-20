export class ErroDominio extends Error {
  constructor(
    mensagem: string,
    public readonly statusCode: number = 422,
  ) {
    super(mensagem);
    this.name = "ErroDominio";
  }
}

export function ehViolacaoUnica(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    (erro as { code: unknown }).code === "P2002"
  );
}