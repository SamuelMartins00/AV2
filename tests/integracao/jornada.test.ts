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
  metodo: "GET" | "POST" | "PATCH",
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
      { usuario: "admin", hashSenha: await hash(SENHAS.admin), papel: "ADMINISTRADOR" },
      { usuario: "operador", hashSenha: await hash(SENHAS.operador), papel: "OPERADOR_CADASTRO" },
      { usuario: "gestor", hashSenha: await hash(SENHAS.gestor), papel: "GESTOR_ALMOXARIFADO" },
      { usuario: "auditor", hashSenha: await hash(SENHAS.auditor), papel: "AUDITOR" },
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

    const ok = await chamar("POST", `/lotes/${ctx.lote.id}/triagem`, "gestor", { versao: ctx.lote.versao });
    expect(ok.status).toBe(200);
    expect(ok.corpo.statusProcessamento).toBe("TRIAGEM_CONCLUIDA");
    expect(ok.corpo.equipamentos.every((e: any) => e.statusRastreamento === "AGUARDANDO_DESMONTE")).toBe(true);
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
      versao: novo.versao + 1, // a triagem incrementou a versão
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
    expect(org.corpo.equipamentosPorStatus).toMatchObject({ AGUARDANDO_DESMONTE: 3, EM_DESMONTE: 1, AGUARDANDO_TRIAGEM: 0 });

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
  });

  it("o logout revoga o refresh token", async () => {
    const login = await chamar("POST", "/auth/login", undefined, { usuario: "operador", senha: SENHAS.operador });
    const rt = login.corpo.refreshToken;
    expect((await chamar("POST", "/auth/logout", undefined, { refreshToken: rt })).status).toBe(204);
    expect((await chamar("POST", "/auth/refresh", undefined, { refreshToken: rt })).status).toBe(401);
  });

  it("o administrador cria um usuário e o hash da senha nunca vai ao journal", async () => {
    const criado = await chamar("POST", "/usuarios", "admin", { usuario: "ana.silva", senha: "Senha@1234", papel: "AUDITOR" });
    expect(criado.status).toBe(201);
    expect(criado.corpo).not.toHaveProperty("hashSenha");
    expect((await chamar("POST", "/usuarios", "admin", { usuario: "ana.silva", senha: "Senha@1234", papel: "AUDITOR" })).status).toBe(409);

    const lista = await chamar("GET", "/usuarios", "admin");
    expect(lista.corpo.map((u: any) => u.usuario)).toContain("ana.silva");
    expect(JSON.stringify(lista.corpo)).not.toContain("hashSenha");

    const todos = await prisma.journalTransacao.findMany();
    expect(JSON.stringify(todos)).not.toContain("hashSenha");
    expect(JSON.stringify(todos)).not.toContain("$2");
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
});
