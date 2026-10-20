export class ErroDominio extends Error {
  constructor(
    mensagem: string,
    public readonly statusCode: number = 422,
  ) {
    super(mensagem);
    this.name = "ErroDominio";
  }
}