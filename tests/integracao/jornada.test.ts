import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

// ---------------------------------------------------------------------------
// Jornada completa do greencode contra um banco MySQL real (exclusivo de testes):
// login -> cadastro -> lote -> triagem -> movimentação -> rastreabilidade.
// ---------------------------------------------------------------------------

type Resposta = { status: number; corpo: any };

let app: FastifyInstance;
const token: Record<string, string> = {};
const refresh: Record<string, string> = {};

// Estado compartilhado entre os passos da jornada (rodam em ordem)
const ctx = {
  organizacaoId: 0,
  lote: null as any,
  equipamentos: [] as any[],
};

const SENHAS = {
  admin: "Admin@12345",
  operador: "Operador@12345",
  gestor: "Gestor@12345",
  auditor: "Auditor@12345",
} as const;

const dataISO = (dias: number) =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

async function chamar(
  metodo: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  quem?: string,
  corpo?: unknown,
): Promise<Resposta> {
  const resposta = await app.inject({
    method: metodo,
    url: `/api/v1${url}`,
    headers: quem ? { authorization: `Bearer ${token[quem]}` } : {},
    payload: corpo as object | undefined,
  });
  return {
    status: resposta.statusCode,
    corpo: resposta.body ? JSON.parse(resposta.body) : null,
  };
}

async function limparBanco() {
  // Ordem inversa das dependências entre tabelas
  await prisma.journalTransacao.deleteMany();
  await prisma.movimentacao.deleteMany();
  await prisma.equipamento.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.organizacao.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.configuracaoGlobal.deleteMany();
}

beforeAll(async () => {
  const banco = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (!banco.endsWith("_test")) {
    throw new Error(`Recusado: "${banco}" não é um banco de testes (deve terminar em _test).`);
  }

  await limparBanco();

  const hash = (s: string) => bcrypt.hash(s, 4);
  await prisma.usuario.createMany({
    data: [
      { usuario: "admin", nomeExibicao: "Administrador", hashSenha: await hash(SENHAS.admin), papel: "ADMINISTRADOR" },
      { usuario: "operador", nomeExibicao: "Operador", hashSenha: await hash(SENHAS.operador), papel: "OPERADOR_CADASTRO" },
      { usuario: "gestor", nomeExibicao: "Gestor", hashSenha: await hash(SENHAS.gestor), papel: "GESTOR_ALMOXARIFADO" },
      { usuario: "auditor", nomeExibicao: "Auditor", hashSenha: await hash(SENHAS.auditor), papel: "AUDITOR" },
    ],
  });
  await prisma.configuracaoGlobal.create({ data: { id: 1 } });

  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe("Jornada completa do greencode", () => {
  it("1. autentica os quatro papéis e recusa credenciais inválidas", async () => {
    for (const quem of Object.keys(SENHAS) as (keyof typeof SENHAS)[]) {
      const r = await chamar("POST", "/auth/login", undefined, {
        usuario: quem,
        senha: SENHAS[quem],
      });
      expect(r.status).toBe(200);
      expect(r.corpo.tipo).toBe("Bearer");
      token[quem] = r.corpo.accessToken;
      refresh[quem] = r.corpo.refreshToken;
    }

    const perfil = await chamar("GET", "/auth/me", "gestor");
    expect(perfil.corpo).toMatchObject({ usuario: "gestor", papel: "GESTOR_ALMOXARIFADO" });

    const errada = await chamar("POST", "/auth/login", undefined, { usuario: "admin", senha: "errada" });
    expect(errada.status).toBe(401);
    expect((await chamar("GET", "/auth/me")).status).toBe(401);
  });

  it("2. o operador cadastra uma organização com contrato vigente", async () => {
    const r = await chamar("POST", "/organizacoes", "operador", {
      razaoSocial: "Banco Exemplo S.A.",
      cnpj: "11.222.333/0001-81",
      enderecoCompleto: "Av. Paulista, 1000, São Paulo",
      contrato: {
        dataVencimento: dataISO(365),
        valorMensal: 1500.5,
        renovacaoAutomatica: true,
        duracaoRenovacaoMeses: 12,
        clausulas: ["Coleta mensal", "Descarte certificado"],
      },
    });
    expect(r.status).toBe(201);
    expect(r.corpo.cnpj).toBe("11222333000181");
    expect(r.corpo.versao).toBe(1);
    expect(r.corpo.contrato).toMatchObject({ vigente: true, valorMensal: 1500.5, versao: 1 });
    expect(r.corpo.contrato.clausulas).toEqual(["Coleta mensal", "Descarte certificado"]);
    ctx.organizacaoId = r.corpo.id;
  });

  it("3. recusa CNPJ inválido e CNPJ duplicado", async () => {
    const base = { razaoSocial: "X", enderecoCompleto: "Rua A" };
    const invalido = await chamar("POST", "/organizacoes", "operador", { ...base, cnpj: "11.222.333/0001-82" });
    expect(invalido.status).toBe(400);
    const duplicado = await chamar("POST", "/organizacoes", "operador", { ...base, cnpj: "11222333000181" });
    expect(duplicado.status).toBe(409);
  });

  it("3.1 exige duração explícita ao habilitar renovação automática", async () => {
    const r = await chamar("POST", "/organizacoes", "operador", {
      razaoSocial: "Contrato sem duração",
      cnpj: "98.765.432/0001-98",
      enderecoCompleto: "Rua de teste",
      contrato: { dataVencimento: dataISO(365), valorMensal: 100, renovacaoAutomatica: true },
    });
    expect(r.status).toBe(422);
  });

  it("4. o gestor registra um lote com equipamentos e códigos de barras automáticos", async () => {
    const r = await chamar("POST", "/lotes", "gestor", {
      dataEntrada: dataISO(-1),
      organizacaoId: ctx.organizacaoId,
      notaFiscal: "NF-1001",
      transportadora: "TransRápida",
      equipamentos: [
        { tipo: "NOTEBOOK", marca: "Dell", modelo: "Latitude", anoFabricacao: 2021, estadoFisico: "BOM_ESTADO", pesoQuilogramas: 2.1 },
        { tipo: "NOTEBOOK", marca: "Lenovo", modelo: "ThinkPad", anoFabricacao: 2022, estadoFisico: "NOVO", pesoQuilogramas: 1.8 },
        { tipo: "MONITOR", marca: "LG", modelo: "24MK", anoFabricacao: 2020, estadoFisico: "USADO_LEVE", pesoQuilogramas: 7.8 },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({ statusProcessamento: "RECEBIDO", quantidadeEquipamentos: 3, pesoTotalKg: 11.7, versao: 1 });
    expect(r.corpo.equipamentos.map((e: any) => e.codigoBarrasInterno)).toEqual([
      "NOTEBOOK-000001",
      "NOTEBOOK-000002",
      "MONITOR-000001",
    ]);
    expect(r.corpo.equipamentos.map((e: any) => e.posicaoNoLote)).toEqual([1, 2, 3]);
    ctx.lote = r.corpo;
  });

  it("5. valida a data de entrada e a existência da organização", async () => {
    const base = { organizacaoId: ctx.organizacaoId, notaFiscal: "NF-2", transportadora: "T" };
    expect((await chamar("POST", "/lotes", "gestor", { ...base, dataEntrada: dataISO(5) })).status).toBe(422);
    expect((await chamar("POST", "/lotes", "gestor", { ...base, dataEntrada: dataISO(-120) })).status).toBe(422);
    expect((await chamar("POST", "/lotes", "gestor", { ...base, organizacaoId: 9999, dataEntrada: dataISO(-1) })).status).toBe(404);
  });

  it("6. adiciona equipamento ao lote e a versão do lote avança", async () => {
    const r = await chamar("POST", `/lotes/${ctx.lote.id}/equipamentos`, "gestor", {
      equipamentos: [
        { tipo: "NOTEBOOK", marca: "HP", modelo: "ProBook", anoFabricacao: 2019, estadoFisico: "USADO_MODERADO", pesoQuilogramas: 2.3 },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.corpo.versao).toBe(2);
    expect(r.corpo.quantidadeEquipamentos).toBe(4);
    expect(r.corpo.equipamentos[3]).toMatchObject({ codigoBarrasInterno: "NOTEBOOK-000003", posicaoNoLote: 4 });
    ctx.lote = r.corpo;
    ctx.equipamentos = r.corpo.equipamentos;
  });

  it("7. impede desmontagem antes da triagem", async () => {
    const eq = ctx.equipamentos[0];
    const mover = await chamar("POST", `/equipamentos/${eq.id}/movimentacoes`, "gestor", { destino: "Bancada de Desmontagem" });
    expect(mover.status).toBe(409);
    const status = await chamar("PATCH", `/equipamentos/${eq.id}/status`, "gestor", {
      versao: eq.versao,
      novoStatus: "EM_DESMONTE",
      justificativa: "Tentativa",
    });
    expect(status.status).toBe(409);
  });

  it("8. a triagem conflita com versão antiga e conclui com a versão correta", async () => {
    const antiga = await chamar("POST", `/lotes/${ctx.lote.id}/triagem`, "gestor", { versao: 1 });
    expect(antiga.status).toBe(409);
    const incompleta = await chamar("POST", `/lotes/${ctx.lote.id}/triagem`, "gestor", { versao: ctx.lote.versao });
    expect(incompleta.status).toBe(422);

    // A avaliação é individual; a decisão não altera o status operacional.
    for (const equipamento of ctx.equipamentos) {
      const avaliacao = await chamar("POST", `/equipamentos/${equipamento.id}/triagem`, "gestor", {
        versao: equipamento.versao,
        resultadoTriagem: "APROVADO_PARA_DESMONTAGEM",
        justificativa: "Avaliação individual concluída para teste.",
      });
      expect(avaliacao.status).toBe(200);
      expect(avaliacao.corpo.resultadoTriagem).toBe("APROVADO_PARA_DESMONTAGEM");
      expect(avaliacao.corpo.statusRastreamento).toBe("AGUARDANDO_TRIAGEM");
    }
    const loteAtualizado = await chamar("GET", `/lotes/${ctx.lote.id}`, "gestor");
    const ok = await chamar("POST", `/lotes/${ctx.lote.id}/triagem`, "gestor", { versao: loteAtualizado.corpo.versao });
    expect(ok.status).toBe(200);
    expect(ok.corpo.statusProcessamento).toBe("TRIAGEM_CONCLUIDA");
    expect(ok.corpo.equipamentos.every((e: any) => e.statusRastreamento === "AGUARDANDO_TRIAGEM")).toBe(true);
    ctx.lote = ok.corpo;
    ctx.equipamentos = ok.corpo.equipamentos;
  });

  it("9. recusa triagem repetida e novos equipamentos depois da triagem", async () => {
    const repetida = await chamar("POST", `/lotes/${ctx.lote.id}/triagem`, "gestor", { versao: ctx.lote.versao });
    expect(repetida.status).toBe(422);
    const adicionar = await chamar("POST", `/lotes/${ctx.lote.id}/equipamentos`, "gestor", {
      equipamentos: [{ tipo: "NOTEBOOK", marca: "X", modelo: "Y", anoFabricacao: 2020, estadoFisico: "NOVO", pesoQuilogramas: 1 }],
    });
    expect(adicionar.status).toBe(422);
  });

  it("10. movimenta, inicia o desmonte e piora o estado com justificativa", async () => {
    const eq = ctx.equipamentos[0];

    const m1 = await chamar("POST", `/equipamentos/${eq.id}/movimentacoes`, "gestor", { destino: "Bancada de Desmontagem", observacao: "Início" });
    expect(m1.status).toBe(201);
    expect(m1.corpo).toMatchObject({ origem: "Entrada", destino: "Bancada de Desmontagem", responsavel: "gestor" });
    const m2 = await chamar("POST", `/equipamentos/${eq.id}/movimentacoes`, "gestor", { destino: "Estoque de peças" });
    expect(m2.corpo).toMatchObject({ origem: "Bancada de Desmontagem", destino: "Estoque de peças" });

    const atual = (await chamar("GET", `/equipamentos/${eq.id}/historico`, "gestor")).corpo.equipamento;
    const status = await chamar("PATCH", `/equipamentos/${eq.id}/status`, "gestor", {
      versao: atual.versao,
      novoStatus: "EM_DESMONTE",
      justificativa: "Início do desmonte",
    });
    expect(status.status).toBe(200);
    expect(status.corpo.statusRastreamento).toBe("EM_DESMONTE");

    // NOVO -> USADO_LEVE piora 2 categorias: exige justificativa
    const novo = ctx.equipamentos[1];
    const semJustificativa = await chamar("PATCH", `/equipamentos/${novo.id}/estado-fisico`, "gestor", {
      versao: novo.versao, // versão retornada após a avaliação individual
      novoEstado: "USADO_LEVE",
    });
    expect(semJustificativa.status).toBe(422);
  });

  it("11. o auditor consulta a rastreabilidade completa", async () => {
    const eq = ctx.equipamentos[0];
    const r = await chamar("GET", `/equipamentos/${eq.id}/historico`, "auditor");
    expect(r.status).toBe(200);
    expect(r.corpo.equipamento.statusRastreamento).toBe("EM_DESMONTE");
    expect(r.corpo.movimentacoes.map((m: any) => [m.origem, m.destino])).toEqual([
      ["Entrada", "Bancada de Desmontagem"],
      ["Bancada de Desmontagem", "Estoque de peças"],
    ]);
  });

  it("12. os relatórios refletem os dados da jornada", async () => {
    const periodo = `inicio=${dataISO(-30)}&fim=${dataISO(30)}`;

    const org = await chamar("GET", `/relatorios/organizacao/${ctx.organizacaoId}?${periodo}`, "auditor");
    expect(org.status).toBe(200);
    expect(org.corpo).toMatchObject({ lotesRecebidos: 1, equipamentosRecebidos: 4, pesoTotalKg: 14 });
    expect(org.corpo.equipamentosPorStatus).toMatchObject({ AGUARDANDO_DESMONTE: 0, EM_DESMONTE: 1, AGUARDANDO_TRIAGEM: 3 });

    const porStatus = await chamar("GET", "/relatorios/status?status=EM_DESMONTE", "auditor");
    expect(porStatus.corpo.quantidade).toBe(1);
    expect(porStatus.corpo.equipamentos[0].codigoBarrasInterno).toBe("NOTEBOOK-000001");

    const fin = await chamar("GET", `/relatorios/financeiro?${periodo}`, "admin");
    expect(fin.corpo).toMatchObject({
      contratosNoPeriodo: 1,
      valorMensalTotal: 1500.5,
      aliquotaImpostos: 0.18,
      impostoEstimado: 270.09,
    });
  });

  it("13. os parâmetros globais alteram a depreciação e o relatório financeiro", async () => {
    const eq = ctx.equipamentos[0]; // NOTEBOOK de 2021, BOM_ESTADO
    const anos = new Date().getFullYear() - 2021;
    const antes = (await chamar("GET", `/equipamentos/${eq.id}/depreciacao`, "gestor")).corpo.depreciacaoAcumulada;
    // residual = 1000 * 0,8^anos * (1 - 1*0,08)
    expect(antes).toBeCloseTo(1000 - 1000 * Math.pow(0.8, anos) * 0.92, 1);

    const patch = await chamar("PATCH", "/configuracao", "admin", { coeficienteDepreciacao: 0.1, aliquotaImpostos: 0.1 });
    expect(patch.status).toBe(200);
    const depois = (await chamar("GET", `/equipamentos/${eq.id}/depreciacao`, "gestor")).corpo.depreciacaoAcumulada;
    expect(depois).toBeLessThan(antes);

    const periodo = `inicio=${dataISO(-30)}&fim=${dataISO(30)}`;
    expect((await chamar("GET", `/relatorios/financeiro?${periodo}`, "admin")).corpo.impostoEstimado).toBe(150.05);

    await chamar("PATCH", "/configuracao", "admin", { coeficienteDepreciacao: 0.2, aliquotaImpostos: 0.18 });
  });

  it("14. respeita as permissões de cada papel", async () => {
    const eq = ctx.equipamentos[0].id;
    const casos: [string, "GET" | "POST" | "PATCH", string, number][] = [
      ["operador", "GET", "/lotes", 403],
      ["auditor", "GET", "/lotes", 403],
      ["gestor", "GET", "/organizacoes", 403],
      ["gestor", "GET", "/relatorios/status?status=EM_DESMONTE", 403],
      ["operador", "GET", `/equipamentos/${eq}/historico`, 403],
      ["auditor", "GET", `/equipamentos/${eq}/depreciacao`, 403],
      ["gestor", "GET", "/configuracao", 403],
      ["auditor", "GET", "/usuarios", 403],
      ["admin", "GET", "/lotes", 200],
      ["admin", "GET", "/organizacoes", 200],
      ["auditor", "GET", `/equipamentos/${eq}/historico`, 200],
      ["admin", "GET", "/usuarios", 200],
    ];
    for (const [quem, metodo, url, esperado] of casos) {
      const r = await chamar(metodo, url, quem);
      expect(r.status, `${quem} ${metodo} ${url}`).toBe(esperado);
    }
  });

  it("15. renova contrato com controle de versão", async () => {
    const org = (await chamar("GET", `/organizacoes/${ctx.organizacaoId}`, "operador")).corpo;
    const renovado = await chamar("POST", `/organizacoes/${ctx.organizacaoId}/contrato/renovar`, "operador", {
      novoVencimento: dataISO(730),
      versao: org.contrato.versao,
    });
    expect(renovado.status).toBe(200);
    expect(renovado.corpo.contrato.versao).toBe(2);

    const desatualizada = await chamar("POST", `/organizacoes/${ctx.organizacaoId}/contrato/renovar`, "operador", {
      novoVencimento: dataISO(800),
      versao: org.contrato.versao,
    });
    expect(desatualizada.status).toBe(409);
  });

  it("16. lista organizações com paginação e filtros", async () => {
    const lista = await chamar("GET", "/organizacoes?page=1&limit=10", "operador");
    expect(lista.status).toBe(200);
    expect(lista.corpo).toMatchObject({ pagination: { page: 1, limit: 10 } });
    expect(Array.isArray(lista.corpo.items)).toBe(true);

    const porNome = await chamar("GET", "/organizacoes?razaoSocial=Banco&page=1&limit=20", "operador");
    expect(porNome.corpo.items.some((o: any) => o.id === ctx.organizacaoId)).toBe(true);
    const porCnpj = await chamar("GET", "/organizacoes?cnpj=11222333000181", "operador");
    expect(porCnpj.corpo.items.some((o: any) => o.id === ctx.organizacaoId)).toBe(true);
    expect((await chamar("GET", "/organizacoes?limit=101", "operador")).status).toBe(400);
  });

  it("17. atualiza CNPJ com normalização, unicidade e versão", async () => {
    const outra = await chamar("POST", "/organizacoes", "operador", { razaoSocial: "Outra organização", cnpj: "98.765.432/0001-98", enderecoCompleto: "Rua C, 3" });
    expect(outra.status).toBe(201);
    const org = (await chamar("GET", `/organizacoes/${ctx.organizacaoId}`, "operador")).corpo;
    const invalido = await chamar("PATCH", `/organizacoes/${ctx.organizacaoId}`, "operador", { versao: org.versao, cnpj: "11222333000182" });
    expect(invalido.status).toBe(400);
    const atualizado = await chamar("PATCH", `/organizacoes/${ctx.organizacaoId}`, "operador", { versao: org.versao, cnpj: "12.345.678/0001-95" });
    expect(atualizado.status).toBe(200);
    expect(atualizado.corpo.cnpj).toBe("12345678000195");
    const atual = atualizado.corpo;
    const duplicado = await chamar("PATCH", `/organizacoes/${ctx.organizacaoId}`, "operador", { versao: atual.versao, cnpj: "98.765.432/0001-98" });
    expect(duplicado.status).toBe(409);
    const revertido = await chamar("PATCH", `/organizacoes/${ctx.organizacaoId}`, "operador", { versao: atual.versao, cnpj: "11.222.333/0001-81" });
    expect(revertido.status).toBe(200);
  });

  it("18. desativa e reativa sem perder contrato ou histórico", async () => {
    const org = (await chamar("GET", `/organizacoes/${ctx.organizacaoId}`, "operador")).corpo;
    const desativada = await chamar("PATCH", `/organizacoes/${ctx.organizacaoId}`, "operador", { versao: org.versao, desativar: true });
    expect(desativada.status).toBe(200);
    expect(desativada.corpo.ativo).toBe(false);
    expect(desativada.corpo.contrato).not.toBeNull();
    const reativada = await chamar("POST", `/organizacoes/${ctx.organizacaoId}/reativar`, "operador", { versao: desativada.corpo.versao });
    expect(reativada.status).toBe(200);
    expect(reativada.corpo.ativo).toBe(true);
  });
});

describe("Concorrência (requisições simultâneas)", () => {
  it("duas atualizações com a mesma versão: uma vence e a outra recebe 409", async () => {
    const eq = ctx.equipamentos[2];
    const atual = (await chamar("GET", `/equipamentos/${eq.id}/historico`, "gestor")).corpo.equipamento;

    const [a, b] = await Promise.all([
      chamar("PATCH", `/equipamentos/${eq.id}/estado-fisico`, "gestor", { versao: atual.versao, novoEstado: "BOM_ESTADO" }),
      chamar("PATCH", `/equipamentos/${eq.id}/estado-fisico`, "gestor", { versao: atual.versao, novoEstado: "USADO_LEVE", justificativa: "Teste" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("dois cadastros simultâneos com o mesmo CNPJ: um é criado, o outro recebe 409", async () => {
    const corpo = { razaoSocial: "Concorrente Ltda", cnpj: "45.246.333/0001-33", enderecoCompleto: "Rua B, 2" };
    const [a, b] = await Promise.all([
      chamar("POST", "/organizacoes", "operador", corpo),
      chamar("POST", "/organizacoes", "operador", corpo),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.organizacao.count({ where: { cnpj: "45246333000133" } })).toBe(1);
  });

  it("movimentações simultâneas mantêm a cadeia de origem e destino consistente", async () => {
    const eq = ctx.equipamentos[3];
    const destinos = ["Doca 1", "Doca 2", "Doca 3", "Doca 4"];
    const resultados = await Promise.all(
      destinos.map((destino) => chamar("POST", `/equipamentos/${eq.id}/movimentacoes`, "gestor", { destino })),
    );
    expect(resultados.every((r) => r.status === 201)).toBe(true);

    const historico = (await chamar("GET", `/equipamentos/${eq.id}/historico`, "gestor")).corpo.movimentacoes;
    expect(historico).toHaveLength(4);
    expect(historico[0].origem).toBe("Entrada");
    for (let i = 1; i < historico.length; i++) {
      expect(historico[i].origem).toBe(historico[i - 1].destino);
    }
  });

  it("lotes criados ao mesmo tempo recebem códigos de barras únicos", async () => {
    const novoLote = () =>
      chamar("POST", "/lotes", "gestor", {
        dataEntrada: dataISO(-1),
        organizacaoId: ctx.organizacaoId,
        notaFiscal: "NF-CONC",
        transportadora: "T",
        equipamentos: [
          { tipo: "SERVIDOR", marca: "Dell", modelo: "R430", anoFabricacao: 2016, estadoFisico: "USADO_LEVE", pesoQuilogramas: 20 },
          { tipo: "SERVIDOR", marca: "Dell", modelo: "R440", anoFabricacao: 2018, estadoFisico: "BOM_ESTADO", pesoQuilogramas: 21 },
        ],
      });

    const respostas = await Promise.all([novoLote(), novoLote(), novoLote()]);
    expect(respostas.map((r) => r.status)).toEqual([201, 201, 201]);

    const codigos = respostas.flatMap((r) => r.corpo.equipamentos.map((e: any) => e.codigoBarrasInterno));
    expect(codigos).toHaveLength(6);
    expect(new Set(codigos).size).toBe(6);
  });
});

describe("Sessão e auditoria", () => {
  it("o refresh token é rotacionado e o token antigo derruba a sessão", async () => {
    const antigo = refresh["gestor"]!;
    const novo = await chamar("POST", "/auth/refresh", undefined, { refreshToken: antigo });
    expect(novo.status).toBe(200);
    expect(novo.corpo.refreshToken).not.toBe(antigo);

    // reapresentar o token já usado: 401 e todas as sessões do usuário caem
    const reuso = await chamar("POST", "/auth/refresh", undefined, { refreshToken: antigo });
    expect(reuso.status).toBe(401);
    const derrubado = await chamar("POST", "/auth/refresh", undefined, { refreshToken: novo.corpo.refreshToken });
    expect(derrubado.status).toBe(401);
    expect(await prisma.journalTransacao.count({ where: { entidade: "Autenticacao", operacao: "REFRESH_ROTACIONADO", usuarioResponsavel: "gestor" } })).toBeGreaterThan(0);
    expect(await prisma.journalTransacao.count({ where: { entidade: "Autenticacao", operacao: "REFRESH_REUTILIZADO", usuarioResponsavel: "gestor" } })).toBeGreaterThan(0);
    const journal = JSON.stringify(await prisma.journalTransacao.findMany({ where: { entidade: "Autenticacao" } }));
    expect(journal).not.toContain(antigo);
    expect(journal).not.toContain(novo.corpo.refreshToken);
  });

  it("o logout revoga o refresh token", async () => {
    const login = await chamar("POST", "/auth/login", undefined, { usuario: "operador", senha: SENHAS.operador });
    const rt = login.corpo.refreshToken;
    expect((await chamar("POST", "/auth/logout", undefined, { refreshToken: rt })).status).toBe(204);
    expect((await chamar("POST", "/auth/refresh", undefined, { refreshToken: rt })).status).toBe(401);
    expect(await prisma.journalTransacao.count({ where: { entidade: "Autenticacao", operacao: "LOGOUT_SUCESSO", usuarioResponsavel: "operador" } })).toBeGreaterThan(0);
    expect(JSON.stringify(await prisma.journalTransacao.findMany({ where: { entidade: "Autenticacao" } }))).not.toContain(rt);
  });

  it("o administrador cria um usuário e o hash da senha nunca vai ao journal", async () => {
    const criado = await chamar("POST", "/usuarios", "admin", { usuario: "ana.silva", nomeExibicao: "Ana Silva", senha: "Senha@1234", papel: "AUDITOR" });
    expect(criado.status).toBe(201);
    expect(criado.corpo).not.toHaveProperty("hashSenha");
    expect((await chamar("POST", "/usuarios", "admin", { usuario: "ana.silva", nomeExibicao: "Ana Silva", senha: "Senha@1234", papel: "AUDITOR" })).status).toBe(409);

    const lista = await chamar("GET", "/usuarios", "admin");
    expect(lista.corpo.items.map((u: any) => u.usuario)).toContain("ana.silva");
    expect(lista.corpo.items.find((u: any) => u.usuario === "ana.silva").nomeExibicao).toBe("Ana Silva");
    expect((await chamar("GET", "/usuarios?limit=101", "admin")).status).toBe(400);
    expect(JSON.stringify(lista.corpo)).not.toContain("hashSenha");

    const todos = await prisma.journalTransacao.findMany();
    expect(JSON.stringify(todos)).not.toContain("hashSenha");
    expect(JSON.stringify(todos)).not.toContain("$2");
  });

  it("autoatendimento atualiza o nome e rejeita campos não permitidos", async () => {
    const atualizado = await chamar("PATCH", "/usuarios/me", "admin", { nomeExibicao: "Administrador Green" });
    expect(atualizado.status).toBe(200);
    expect(atualizado.corpo.nomeExibicao).toBe("Administrador Green");
    expect((await chamar("PATCH", "/usuarios/me", "admin", { nomeExibicao: "x", papel: "AUDITOR" })).status).toBe(400);
  });

  it("promoção exige senha atual e não permite rebaixar outro administrador", async () => {
    expect((await chamar("POST", "/usuarios", "admin", { usuario: "admin.novo", nomeExibicao: "Admin Novo", senha: "Senha@1234", papel: "ADMINISTRADOR" })).status).toBe(422);
    const ana = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "ana.silva" } });
    expect((await chamar("PATCH", `/usuarios/${ana.id}`, "admin", { papel: "ADMINISTRADOR", senhaAtualAdmin: "errada" })).status).toBe(422);
    expect((await chamar("PATCH", `/usuarios/${ana.id}`, "admin", { papel: "ADMINISTRADOR", senhaAtualAdmin: SENHAS.admin })).status).toBe(200);
    const atualizado = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "ana.silva" } });
    expect(atualizado.papel).toBe("ADMINISTRADOR");
    expect((await chamar("PATCH", `/usuarios/${atualizado.id}`, "admin", { papel: "AUDITOR" })).status).toBe(403);
    expect((await chamar("PATCH", `/usuarios/${atualizado.id}/desativar`, "admin")).status).toBe(403);
  });

  it("desativação invalida access e refresh tokens; reativação exige novo login", async () => {
    const criado = await chamar("POST", "/usuarios", "admin", { usuario: "conta.inativa", nomeExibicao: "Conta Inativa", senha: "Senha@1234", papel: "AUDITOR" });
    expect(criado.status).toBe(201);
    const login = await chamar("POST", "/auth/login", undefined, { usuario: "conta.inativa", senha: "Senha@1234" });
    expect(login.status).toBe(200);
    token["conta.inativa"] = login.corpo.accessToken;
    const conta = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "conta.inativa" } });
    expect((await chamar("PATCH", `/usuarios/${conta.id}/desativar`, "admin")).status).toBe(200);
    expect((await chamar("GET", "/auth/me", "conta.inativa")).status).toBe(401);
    expect((await chamar("POST", "/auth/refresh", undefined, { refreshToken: login.corpo.refreshToken })).status).toBe(401);
    expect((await chamar("PATCH", `/usuarios/${conta.id}/reativar`, "admin")).status).toBe(200);
    expect((await chamar("GET", "/auth/me", "conta.inativa")).status).toBe(401);
    const novoLogin = await chamar("POST", "/auth/login", undefined, { usuario: "conta.inativa", senha: "Senha@1234" });
    expect(novoLogin.status).toBe(200);
  });

  it("redefinição administrativa exige troca de senha e invalida tokens anteriores", async () => {
    const conta = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "conta.inativa" } });
    expect((await chamar("PUT", `/usuarios/${conta.id}/senha`, "admin", { senhaNova: "Temporaria@123" })).status).toBe(204);
    const login = await chamar("POST", "/auth/login", undefined, { usuario: "conta.inativa", senha: "Temporaria@123" });
    expect(login.status).toBe(200);
    token["conta.inativa"] = login.corpo.accessToken;
    expect((await chamar("GET", "/auth/me", "conta.inativa")).status).toBe(403);
    expect((await chamar("POST", "/auth/alterar-senha", "conta.inativa", { senhaAtual: "Temporaria@123", senhaNova: "Definitiva@123" })).status).toBe(204);
    expect((await chamar("GET", "/auth/me", "conta.inativa")).status).toBe(401);
    expect((await chamar("POST", "/auth/login", undefined, { usuario: "conta.inativa", senha: "Definitiva@123" })).status).toBe(200);
  });

  it("o journal registrou as operações da jornada com o usuário responsável", async () => {
    const operacoes = new Set((await prisma.journalTransacao.findMany()).map((j) => j.operacao));
    for (const esperada of [
      "CRIAR",
      "ADICIONAR_EQUIPAMENTO",
      "PROCESSAR_TRIAGEM",
      "REGISTRAR_MOVIMENTACAO",
      "ATUALIZAR_STATUS",
      "ATUALIZAR_PARAMETROS",
      "RENOVAR_CONTRATO",
      "CRIAR_USUARIO",
    ]) {
      expect(operacoes, esperada).toContain(esperada);
    }

    const triagem = await prisma.journalTransacao.findFirstOrThrow({ where: { operacao: "PROCESSAR_TRIAGEM" } });
    expect(triagem.usuarioResponsavel).toBe("gestor");
    expect(triagem.dadosAntes).not.toBeNull();
    expect(triagem.dadosDepois).not.toBeNull();
  });

  it("serializa auto-rebaixamentos concorrentes e preserva um administrador ativo", async () => {
    const loginAna = await chamar("POST", "/auth/login", undefined, { usuario: "ana.silva", senha: "Senha@1234" });
    expect(loginAna.status).toBe(200);
    token["ana.silva"] = loginAna.corpo.accessToken;
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "admin" } });
    const ana = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "ana.silva" } });

    const resultados = await Promise.all([
      chamar("PATCH", `/usuarios/${admin.id}`, "admin", { papel: "AUDITOR" }),
      chamar("PATCH", `/usuarios/${ana.id}`, "ana.silva", { papel: "AUDITOR" }),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR" } })).toBe(1);

    const restante = await prisma.usuario.findFirstOrThrow({ where: { ativo: true, papel: "ADMINISTRADOR" } });
    const tokenRestante = restante.usuario === "ana.silva" ? "ana.silva" : "admin";
    const ultimo = await chamar("PATCH", `/usuarios/${restante.id}`, tokenRestante, { papel: "AUDITOR" });
    expect(ultimo.status).toBe(409);
    expect((await chamar("PATCH", `/usuarios/${restante.id}/desativar`, tokenRestante)).status).toBe(409);
    expect(await prisma.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR" } })).toBe(1);
    for (const login of ["admin", "ana.silva"]) {
      const registro = await prisma.usuario.findUniqueOrThrow({ where: { usuario: login } });
      if (registro.papel !== "ADMINISTRADOR") expect((await chamar("GET", "/auth/me", login)).status).toBe(401);
    }

    // Este teste pode rebaixar o usuário `admin`, invalidando seu access token.
    // Restaura o fixture para que os testes seguintes continuem testando suas
    // próprias regras de autorização, sem depender da ordem/resultado da corrida.
    const adminAtual = await prisma.usuario.findUniqueOrThrow({ where: { usuario: "admin" } });
    if (adminAtual.papel !== "ADMINISTRADOR") {
      const administradorAtivo = await prisma.usuario.findFirstOrThrow({
        where: { ativo: true, papel: "ADMINISTRADOR" },
      });
      const promover = await chamar(
        "PATCH",
        `/usuarios/${adminAtual.id}`,
        administradorAtivo.usuario,
        { papel: "ADMINISTRADOR", senhaAtualAdmin: administradorAtivo.usuario === "ana.silva" ? "Senha@1234" : SENHAS.admin },
      );
      expect(promover.status).toBe(200);
    }
    const loginAdmin = await chamar("POST", "/auth/login", undefined, {
      usuario: "admin",
      senha: SENHAS.admin,
    });
    expect(loginAdmin.status).toBe(200);
    token.admin = loginAdmin.corpo.accessToken;
  });
});

describe("Encerramento de contratos", () => {
  async function criarOrganizacaoComContrato(cnpj: string) {
    return chamar("POST", "/organizacoes", "operador", {
      razaoSocial: `Contrato ${cnpj}`,
      cnpj,
      enderecoCompleto: "Rua de teste, 1",
      contrato: { dataAssinatura: dataISO(-30), dataVencimento: dataISO(365), valorMensal: 100, renovacaoAutomatica: true, duracaoRenovacaoMeses: 12 },
    });
  }

  it("encerra contrato com motivo, audita e impede renovação posterior", async () => {
    const criada = await criarOrganizacaoComContrato("55566677000183");
    expect(criada.status).toBe(201);
    const org = criada.corpo;
    const encerrada = await chamar("POST", `/organizacoes/${org.id}/contrato/encerrar`, "operador", {
      versao: org.contrato.versao,
      motivo: "Encerramento solicitado pelo cliente",
    });
    expect(encerrada.status).toBe(200);
    expect(encerrada.corpo.contrato.encerradoEm).not.toBeNull();
    expect(encerrada.corpo.contrato.renovacaoAutomatica).toBe(false);
    expect(await prisma.journalTransacao.count({ where: { entidade: "Contrato", operacao: "ENCERRAR_CONTRATO", usuarioResponsavel: "operador" } })).toBeGreaterThan(0);
    const renovar = await chamar("POST", `/organizacoes/${org.id}/contrato/renovar`, "operador", {
      versao: encerrada.corpo.contrato.versao,
      novoVencimento: dataISO(500),
    });
    expect(renovar.status).toBe(409);
  });

  it("não permite reativação com contrato vencido", async () => {
    const criada = await chamar("POST", "/organizacoes", "operador", {
      razaoSocial: "Contrato vencido para reativação",
      cnpj: "31415926000171",
      enderecoCompleto: "Rua de teste, 2",
      contrato: { dataAssinatura: dataISO(-365), dataVencimento: dataISO(-1), valorMensal: 100 },
    });
    expect(criada.status).toBe(201);
    const desativada = await chamar("PATCH", `/organizacoes/${criada.corpo.id}`, "operador", { versao: criada.corpo.versao, desativar: true });
    expect(desativada.status).toBe(200);
    const reativacao = await chamar("POST", `/organizacoes/${criada.corpo.id}/reativar`, "operador", { versao: desativada.corpo.versao });
    expect(reativacao.status).toBe(422);
  });

  it("não permite reativação de organização cujo contrato foi encerrado", async () => {
    const criada = await chamar("POST", "/organizacoes", "operador", {
      razaoSocial: "Contrato encerrado para reativação",
      cnpj: "27182818000129",
      enderecoCompleto: "Rua de teste, 3",
      contrato: { dataAssinatura: dataISO(-30), dataVencimento: dataISO(365), valorMensal: 100 },
    });
    expect(criada.status).toBe(201);
    const desativada = await chamar("PATCH", `/organizacoes/${criada.corpo.id}`, "operador", { versao: criada.corpo.versao, desativar: true });
    expect(desativada.status).toBe(200);
    const encerrada = await chamar("POST", `/organizacoes/${criada.corpo.id}/contrato/encerrar`, "operador", { versao: criada.corpo.contrato.versao, motivo: "Encerramento antes da reativação" });
    expect(encerrada.status).toBe(200);
    const reativacao = await chamar("POST", `/organizacoes/${criada.corpo.id}/reativar`, "operador", { versao: desativada.corpo.versao });
    expect(reativacao.status).toBe(422);
  });

  it("restringe encerramento retroativo a ADMINISTRADOR", async () => {
    const criada = await criarOrganizacaoComContrato("12345678000195");
    expect(criada.status).toBe(201);
    const org = criada.corpo;
    const corpo = {
      versao: org.contrato.versao,
      motivo: "Correção de registro após conferência documental",
      dataEncerramento: dataISO(-10),
    };
    const negada = await chamar("POST", `/organizacoes/${org.id}/contrato/encerrar-retroativo`, "operador", corpo);
    expect(negada.status).toBe(403);
    const aceita = await chamar("POST", `/organizacoes/${org.id}/contrato/encerrar-retroativo`, "admin", corpo);
    expect(aceita.status).toBe(200);
    expect(aceita.corpo.contrato.encerradoEm).not.toBeNull();
  });
});

describe("Baixa definitiva", () => {
  it("exige operação concluída, administrador, justificativa, versão e auditoria", async () => {
    const eq = ctx.equipamentos[0];
    const atual = (await chamar("GET", `/equipamentos/${eq.id}/historico`, "gestor")).corpo.equipamento;
    const baixaPrematura = await chamar("POST", `/equipamentos/${eq.id}/baixa-definitiva`, "admin", {
      versao: atual.versao,
      justificativa: "Tentativa antes da operação final.",
    });
    expect(baixaPrematura.status).toBe(409);
    const resultadoOperacional = await chamar("PATCH", `/equipamentos/${eq.id}/status`, "gestor", {
      versao: atual.versao,
      novoStatus: "DESCARTE_SEGURO",
      justificativa: "Operação de descarte seguro concluída.",
    });
    expect(resultadoOperacional.status).toBe(200);
    const eqAtual = resultadoOperacional.corpo;
    const corpo = { versao: eqAtual.versao, justificativa: "Baixa autorizada após conferência documental." };
    const negada = await chamar("POST", `/equipamentos/${eq.id}/baixa-definitiva`, "gestor", corpo);
    expect(negada.status).toBe(403);
    const baixa = await chamar("POST", `/equipamentos/${eq.id}/baixa-definitiva`, "admin", corpo);
    expect(baixa.status).toBe(200);
    expect(baixa.corpo).toMatchObject({ statusRastreamento: "BAIXA_DEFINITIVA", baixaResponsavel: "admin", baixaJustificativa: corpo.justificativa });
    const duplicada = await chamar("POST", `/equipamentos/${eq.id}/baixa-definitiva`, "admin", corpo);
    expect(duplicada.status).toBe(409);
    const movimentacao = await chamar("POST", `/equipamentos/${eq.id}/movimentacoes`, "gestor", { destino: "Estoque" });
    expect(movimentacao.status).toBe(409);
    expect(await prisma.journalTransacao.count({ where: { operacao: "BAIXA_DEFINITIVA_EQUIPAMENTO", usuarioResponsavel: "admin" } })).toBe(1);
  });
});


describe("Auditoria HTTP", () => {
  it("restringe o journal a administrador e auditor, filtra e pagina sem expor segredos", async () => {
    expect((await chamar("GET", "/auditoria/journal", "operador")).status).toBe(403);

    const resposta = await chamar(
      "GET",
      "/auditoria/journal?entidade=Autenticacao&operacao=LOGIN_SUCESSO&responsavel=admin&pagina=1&limite=100",
      "auditor",
    );
    expect(resposta.status).toBe(200);
    expect(resposta.corpo.registros.length).toBeGreaterThan(0);
    expect(resposta.corpo.registros.every((r: any) => r.entidade === "Autenticacao" && r.operacao === "LOGIN_SUCESSO" && r.usuarioResponsavel.includes("admin"))).toBe(true);
    expect(resposta.corpo.pagina).toBe(1);
    expect(resposta.corpo.limite).toBe(100);
    expect(JSON.stringify(resposta.corpo)).not.toContain(SENHAS.admin);
    expect(JSON.stringify(resposta.corpo)).not.toContain("hashSenha");

    const segredoDeTeste = "SEGREDO_FICTICIO_NAO_EXIBIR";
    await prisma.journalTransacao.create({
      data: {
        operacao: "TESTE_SANITIZACAO",
        entidade: "TesteSeguranca",
        usuarioResponsavel: "admin",
        dadosAntes: { hashSenha: segredoDeTeste, aninhado: { refreshToken: segredoDeTeste }, campoVisivel: "visível" },
        dadosDepois: { senha: segredoDeTeste, observacao: "dado não sensível" },
      },
    });
    const sanitizado = await chamar("GET", "/auditoria/journal?entidade=TesteSeguranca&limite=10", "admin");
    expect(sanitizado.status).toBe(200);
    expect(JSON.stringify(sanitizado.corpo)).not.toContain(segredoDeTeste);
    expect(JSON.stringify(sanitizado.corpo)).not.toContain("hashSenha");
    expect(JSON.stringify(sanitizado.corpo)).toContain("dado não sensível");

    const pagina = await chamar("GET", "/auditoria/journal?limite=1&pagina=1", "admin");
    expect(pagina.status).toBe(200);
    expect(pagina.corpo.registros).toHaveLength(1);
    expect(pagina.corpo.total).toBeGreaterThanOrEqual(1);

    expect((await chamar("GET", "/auditoria/journal?pagina=0", "admin")).status).toBe(400);
    expect((await chamar("GET", "/auditoria/journal?inicio=2026-03-31&fim=2026-03-01", "admin")).status).toBe(422);
  });
});

describe("Relatório financeiro — vigência efetiva no período", () => {
  it("inclui contratos ativos em parte do período e exclui os encerrados ou vencidos antes dele", async () => {
    const contratos = [
      { cnpj: "99000000000001", nome: "Contrato ativo no período", assinatura: "2030-01-01T00:00:00.000Z", vencimento: "2030-12-31T23:59:59.999Z", encerrado: null },
      { cnpj: "99000000000002", nome: "Contrato vencido antes", assinatura: "2029-01-01T00:00:00.000Z", vencimento: "2030-02-28T23:59:59.999Z", encerrado: null },
      { cnpj: "99000000000003", nome: "Contrato encerrado antes", assinatura: "2030-01-01T00:00:00.000Z", vencimento: "2030-12-31T23:59:59.999Z", encerrado: "2030-02-28T23:59:59.999Z" },
      { cnpj: "99000000000004", nome: "Contrato encerrado durante", assinatura: "2030-01-01T00:00:00.000Z", vencimento: "2030-12-31T23:59:59.999Z", encerrado: "2030-03-15T12:00:00.000Z" },
      { cnpj: "99000000000005", nome: "Contrato assinado no limite final", assinatura: "2030-03-31T23:59:59.999Z", vencimento: "2030-12-31T23:59:59.999Z", encerrado: null },
      { cnpj: "99000000000006", nome: "Contrato encerrado no limite inicial", assinatura: "2030-01-01T00:00:00.000Z", vencimento: "2030-12-31T23:59:59.999Z", encerrado: "2030-03-01T00:00:00.000Z" },
    ];

    for (const item of contratos) {
      const organizacao = await prisma.organizacao.create({
        data: { razaoSocial: item.nome, cnpj: item.cnpj, enderecoCompleto: "Registro de teste" },
      });
      await prisma.contrato.create({
        data: {
          organizacaoId: organizacao.id,
          dataAssinatura: new Date(item.assinatura),
          dataVencimento: new Date(item.vencimento),
          clausulas: ["Contrato de teste"],
          valorMensal: 100,
          encerradoEm: item.encerrado ? new Date(item.encerrado) : null,
        },
      });
    }

    const relatorio = await chamar(
      "GET",
      "/relatorios/financeiro?inicio=2030-03-01&fim=2030-03-31",
      "admin",
    );
    expect(relatorio.status).toBe(200);
    expect(relatorio.corpo.contratosNoPeriodo).toBe(4);
    expect(relatorio.corpo.contratos.map((c: any) => c.cnpj).sort()).toEqual([
      "99000000000001",
      "99000000000004",
      "99000000000005",
      "99000000000006",
    ]);
    expect(relatorio.corpo.observacao).toContain("Não representa receita recebida ou reconhecida");
  });
});

describe("Exclusão segura de lotes e equipamentos", () => {
  async function criarLoteVazio() {
    const resposta = await chamar("POST", "/lotes", "gestor", {
      dataEntrada: dataISO(-1),
      organizacaoId: ctx.organizacaoId,
      notaFiscal: `EXCLUSAO-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      transportadora: "Transportadora de teste",
    });
    expect(resposta.status).toBe(201);
    return resposta.corpo;
  }

  async function criarLoteComEquipamento() {
    const resposta = await chamar("POST", "/lotes", "gestor", {
      dataEntrada: dataISO(-1),
      organizacaoId: ctx.organizacaoId,
      notaFiscal: `EXCLUSAO-EQ-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      transportadora: "Transportadora de teste",
      equipamentos: [{
        tipo: "NOTEBOOK",
        marca: "Marca teste",
        modelo: "Modelo para exclusão",
        anoFabricacao: 2021,
        estadoFisico: "NOVO",
        pesoQuilogramas: 1.2,
      }],
    });
    expect(resposta.status).toBe(201);
    return resposta.corpo;
  }

  it("permite excluir lote vazio e registra o evento na auditoria", async () => {
    const lote = await criarLoteVazio();

    expect((await chamar("DELETE", `/lotes/${lote.id}`, "operador")).status).toBe(403);
    expect((await chamar("DELETE", `/lotes/${lote.id}`)).status).toBe(401);

    const removido = await chamar("DELETE", `/lotes/${lote.id}`, "gestor");
    expect(removido.status).toBe(204);
    expect(await prisma.lote.findUnique({ where: { id: lote.id } })).toBeNull();

    const journal = await prisma.journalTransacao.findFirst({
      where: { operacao: "EXCLUIR", entidade: "Lote", usuarioResponsavel: "gestor" },
      orderBy: { id: "desc" },
    });
    expect(journal?.dadosAntes).toMatchObject({ id: lote.id, statusProcessamento: "RECEBIDO" });
  });

  it("bloqueia exclusão de lote com equipamentos e de lote inexistente", async () => {
    const lote = await criarLoteComEquipamento();

    expect((await chamar("DELETE", `/lotes/${lote.id}`, "gestor")).status).toBe(409);
    expect((await chamar("DELETE", "/lotes/2147483647", "gestor")).status).toBe(404);
    expect(await prisma.lote.findUnique({ where: { id: lote.id } })).not.toBeNull();
    expect(await prisma.equipamento.count({ where: { loteId: lote.id } })).toBe(1);
  });

  it("permite excluir equipamento sem histórico e registra o evento no journal", async () => {
    const lote = await criarLoteComEquipamento();
    const equipamento = lote.equipamentos[0];

    const removido = await chamar("DELETE", `/equipamentos/${equipamento.id}`, "gestor");
    expect(removido.status).toBe(204);
    expect(await prisma.equipamento.findUnique({ where: { id: equipamento.id } })).toBeNull();
    expect(await prisma.lote.findUnique({ where: { id: lote.id } })).not.toBeNull();

    const journal = await prisma.journalTransacao.findFirst({
      where: { operacao: "EXCLUIR", entidade: "Equipamento", usuarioResponsavel: "gestor" },
      orderBy: { id: "desc" },
    });
    expect(journal?.dadosAntes).toMatchObject({ id: equipamento.id, loteId: lote.id });
  });

  it("bloqueia exclusão de equipamento com histórico operacional", async () => {
    const equipamento = ctx.equipamentos[0];
    expect(equipamento).toBeDefined();

    const resposta = await chamar("DELETE", `/equipamentos/${equipamento.id}`, "gestor");
    expect(resposta.status).toBe(409);
    expect(await prisma.equipamento.findUnique({ where: { id: equipamento.id } })).not.toBeNull();
    expect(await prisma.movimentacao.count({ where: { equipamentoId: equipamento.id } })).toBeGreaterThan(0);
  });

  it("serializa tentativas concorrentes de exclusão do mesmo lote", async () => {
    const lote = await criarLoteVazio();
    const respostas = await Promise.all([
      chamar("DELETE", `/lotes/${lote.id}`, "gestor"),
      chamar("DELETE", `/lotes/${lote.id}`, "gestor"),
    ]);

    expect(respostas.filter((r) => r.status === 204)).toHaveLength(1);
    expect(respostas.every((r) => [204, 404, 409].includes(r.status))).toBe(true);
    expect(await prisma.lote.findUnique({ where: { id: lote.id } })).toBeNull();
    expect(await prisma.journalTransacao.count({
      where: { operacao: "EXCLUIR", entidade: "Lote", dadosAntes: { path: "$.id", equals: lote.id } },
    })).toBe(1);
  });
});
