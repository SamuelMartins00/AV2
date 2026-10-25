import bcrypt from "bcryptjs";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import type {
  EstadoFisico,
  StatusRastreamento,
  TipoEquipamento,
} from "../src/dominio/enums.js";
import { gerarCodigoBarras } from "../src/dominio/equipamento.js";

type StatusLote =
  | "RECEBIDO"
  | "EM_TRIAGEM"
  | "TRIAGEM_CONCLUIDA"
  | "ENCAMINHADO"
  | "FINALIZADO";

interface EquipamentoSeed {
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  ano: number;
  estado: EstadoFisico;
  peso: number;
  status: StatusRastreamento;
  /** Destinos sucessivos; a origem da 1ª movimentação é "Entrada". */
  movimentacoes?: string[];
}

interface LoteSeed {
  organizacao: number; // índice em ORGANIZACOES
  diasAtras: number;
  notaFiscal: string;
  transportadora: string;
  status: StatusLote;
  observacoes?: string;
  equipamentos: EquipamentoSeed[];
}

const DIA = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA);
const diasAFrente = (n: number) => new Date(Date.now() + n * DIA);

// Senhas apenas para desenvolvimento e testes. Nunca use em produção.
const USUARIOS = [
  { usuario: "admin", senha: "Admin@12345", papel: "ADMINISTRADOR" },
  { usuario: "operador", senha: "Operador@12345", papel: "OPERADOR_CADASTRO" },
  { usuario: "gestor", senha: "Gestor@12345", papel: "GESTOR_ALMOXARIFADO" },
  { usuario: "auditor", senha: "Auditor@12345", papel: "AUDITOR" },
] as const;

// CNPJs fictícios, mas com dígitos verificadores válidos
const ORGANIZACOES = [
  {
    razaoSocial: "Banco BRASIL S.A.",
    cnpj: "11222333000181",
    inscricaoEstadual: "111.222.333.444",
    enderecoCompleto: "Av. Paulistana, 1000, Porto - RS",
    telefone: "1130000001",
    email: "ti@bancobrasil.com.br",
    ativo: true,
    contrato: {
      dataAssinatura: diasAtras(300),
      dataVencimento: diasAFrente(430),
      clausulas: ["Coleta mensal programada", "Certificado de descarte", "Sigilo de dados"],
      valorMensal: 4500,
      renovacaoAutomatica: true,
    },
  },
  {
    razaoSocial: "Rede Varejos Ltda",
    cnpj: "45246333000133",
    inscricaoEstadual: "222.333.444.555",
    enderecoCompleto: "Rua das Lojas, 250, Campinas - SP",
    telefone: "1930000002",
    email: "logistica@varejo.com.br",
    ativo: true,
    contrato: {
      dataAssinatura: diasAtras(120),
      dataVencimento: diasAFrente(245),
      clausulas: ["Coleta quinzenal", "Relatório trimestral de rastreabilidade"],
      valorMensal: 2800.5,
      renovacaoAutomatica: false,
    },
  },
  {
    razaoSocial: "Universidade Pública Exemplo",
    cnpj: "12345678000195",
    inscricaoEstadual: "333.444.555.666",
    enderecoCompleto: "Campus Central, s/n, São José dos Campos - SP",
    telefone: "1230000003",
    email: "patrimonio@universidadeexemplo.edu.br",
    ativo: true,
    contrato: {
      dataAssinatura: diasAtras(60),
      dataVencimento: diasAFrente(305),
      clausulas: ["Coleta sob demanda", "Doação de equipamentos recuperáveis"],
      valorMensal: 1200,
      renovacaoAutomatica: false,
    },
  },
  {
    razaoSocial: "Hospital Municipal Exemplo",
    cnpj: "98765432000198",
    inscricaoEstadual: "444.555.666.777",
    enderecoCompleto: "Rua da Saúde, 80, Taubaté - SP",
    telefone: "1230000004",
    email: "ti@hospitalexemplo.org.br",
    ativo: true,
    contrato: {
      // contrato vencido: serve para testar vigência e renovação
      dataAssinatura: diasAtras(500),
      dataVencimento: diasAtras(20),
      clausulas: ["Descarte seguro de equipamentos médicos de TI"],
      valorMensal: 900,
      renovacaoAutomatica: false,
    },
  },
  {
    razaoSocial: "Clínica Exemplo Ltda",
    cnpj: "55566677000183",
    inscricaoEstadual: null,
    enderecoCompleto: "Rua Antiga, 5, Jacareí - SP",
    telefone: null,
    email: null,
    ativo: false, // inativa e sem contrato
    contrato: null,
  },
] as const;

const LOTES: LoteSeed[] = [
  {
    organizacao: 0,
    diasAtras: 80,
    notaFiscal: "NF-2026-0101",
    transportadora: "TransRápida Logística",
    status: "FINALIZADO",
    observacoes: "Lote de troca de terminais de agência",
    equipamentos: [
      { tipo: "NOTEBOOK", marca: "Dell", modelo: "Latitude 5420", ano: 2018, estado: "USADO_MODERADO", peso: 1.9, status: "BAIXA_DEFINITIVA", movimentacoes: ["Doca de recebimento", "Bancada de desmontagem", "Estoque de peças"] },
      { tipo: "NOTEBOOK", marca: "Lenovo", modelo: "ThinkPad T14", ano: 2019, estado: "BOM_ESTADO", peso: 1.7, status: "PECAS_REAPROVEITADAS", movimentacoes: ["Doca de recebimento", "Bancada de desmontagem"] },
      { tipo: "MONITOR", marca: "LG", modelo: "24MK430H", ano: 2017, estado: "DANIFICADO_LEVE", peso: 4.2, status: "MATERIAL_RECICLAVEL", movimentacoes: ["Doca de recebimento", "Reciclagem de vidro e plástico"] },
      { tipo: "COMPUTADOR_MESA", marca: "HP", modelo: "ProDesk 400", ano: 2016, estado: "INSERVIVEL", peso: 9.5, status: "DESCARTE_SEGURO", movimentacoes: ["Doca de recebimento", "Destruição certificada de mídia"] },
    ],
  },
  {
    organizacao: 1,
    diasAtras: 45,
    notaFiscal: "NF-2026-0188",
    transportadora: "LogVerde Transportes",
    status: "ENCAMINHADO",
    equipamentos: [
      { tipo: "IMPRESSORA", marca: "Epson", modelo: "L3150", ano: 2019, estado: "USADO_MODERADO", peso: 4.1, status: "EM_DESMONTE", movimentacoes: ["Doca de recebimento", "Bancada de desmontagem"] },
      { tipo: "IMPRESSORA", marca: "HP", modelo: "LaserJet M404", ano: 2020, estado: "BOM_ESTADO", peso: 11.4, status: "PECAS_REAPROVEITADAS", movimentacoes: ["Doca de recebimento", "Bancada de desmontagem", "Estoque de peças"] },
      { tipo: "ROTEADOR", marca: "TP-Link", modelo: "Archer C6", ano: 2021, estado: "USADO_LEVE", peso: 0.6, status: "AGUARDANDO_DESMONTE", movimentacoes: ["Doca de recebimento"] },
    ],
  },
  {
    organizacao: 2,
    diasAtras: 25,
    notaFiscal: "NF-2026-0215",
    transportadora: "TransRápida Logística",
    status: "TRIAGEM_CONCLUIDA",
    observacoes: "Laboratório de informática desativado",
    equipamentos: [
      { tipo: "COMPUTADOR_MESA", marca: "Dell", modelo: "OptiPlex 3070", ano: 2019, estado: "USADO_LEVE", peso: 8.9, status: "AGUARDANDO_DESMONTE" },
      { tipo: "COMPUTADOR_MESA", marca: "Dell", modelo: "OptiPlex 3070", ano: 2019, estado: "USADO_MODERADO", peso: 8.9, status: "AGUARDANDO_DESMONTE" },
      { tipo: "COMPUTADOR_MESA", marca: "Positivo", modelo: "Master D3400", ano: 2015, estado: "DANIFICADO_GRAVE", peso: 7.8, status: "AGUARDANDO_DESMONTE" },
      { tipo: "MONITOR", marca: "Samsung", modelo: "S22F350", ano: 2018, estado: "BOM_ESTADO", peso: 3.8, status: "AGUARDANDO_DESMONTE" },
      { tipo: "MONITOR", marca: "Samsung", modelo: "S22F350", ano: 2018, estado: "INSERVIVEL", peso: 3.8, status: "AGUARDANDO_DESMONTE" },
    ],
  },
  {
    organizacao: 3,
    diasAtras: 10,
    notaFiscal: "NF-2026-0240",
    transportadora: "LogVerde Transportes",
    status: "EM_TRIAGEM",
    equipamentos: [
      { tipo: "SERVIDOR", marca: "Dell", modelo: "PowerEdge R430", ano: 2016, estado: "USADO_MODERADO", peso: 21.5, status: "EM_TRIAGEM", movimentacoes: ["Doca de recebimento", "Bancada de triagem"] },
      { tipo: "NOTEBOOK", marca: "Acer", modelo: "Aspire 5", ano: 2020, estado: "BOM_ESTADO", peso: 2.0, status: "AGUARDANDO_TRIAGEM", movimentacoes: ["Doca de recebimento"] },
      { tipo: "FONTE_ALIMENTACAO", marca: "Corsair", modelo: "CV550", ano: 2017, estado: "USADO_LEVE", peso: 1.4, status: "EM_TRIAGEM", movimentacoes: ["Doca de recebimento", "Bancada de triagem"] },
    ],
  },
  {
    organizacao: 0,
    diasAtras: 2,
    notaFiscal: "NF-2026-0262",
    transportadora: "TransRápida Logística",
    status: "RECEBIDO",
    observacoes: "Recebido ontem à tarde; triagem ainda não iniciada",
    equipamentos: [
      { tipo: "NOTEBOOK", marca: "HP", modelo: "ProBook 450", ano: 2021, estado: "NOVO", peso: 2.1, status: "AGUARDANDO_TRIAGEM" },
      { tipo: "NOTEBOOK", marca: "Dell", modelo: "Latitude 3520", ano: 2021, estado: "BOM_ESTADO", peso: 1.8, status: "AGUARDANDO_TRIAGEM" },
      { tipo: "NOTEBOOK", marca: "Lenovo", modelo: "IdeaPad 3", ano: 2020, estado: "USADO_LEVE", peso: 1.7, status: "AGUARDANDO_TRIAGEM" },
      { tipo: "CABO_ESTRUTURADO", marca: "Furukawa", modelo: "Cat6 (rolo 305 m)", ano: 2022, estado: "NOVO", peso: 12.5, status: "AGUARDANDO_TRIAGEM" },
    ],
  },
];

async function criarUsuariosEConfiguracao() {
  for (const u of USUARIOS) {
    const hashSenha = await bcrypt.hash(u.senha, env.bcryptCusto);
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { usuario: u.usuario, nomeExibicao: u.usuario, hashSenha, papel: u.papel },
    });
  }

  await prisma.configuracaoGlobal.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

async function criarDadosDemonstrativos() {
  if ((await prisma.organizacao.count()) > 0) {
    console.log("Já existem organizações: dados demonstrativos não foram criados.");
    console.log("Para recomeçar do zero, rode: npm run db:reset");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const idsOrganizacoes: number[] = [];

      for (const org of ORGANIZACOES) {
        const criada = await tx.organizacao.create({
          data: {
            razaoSocial: org.razaoSocial,
            cnpj: org.cnpj,
            inscricaoEstadual: org.inscricaoEstadual,
            enderecoCompleto: org.enderecoCompleto,
            telefone: org.telefone,
            email: org.email,
            ativo: org.ativo,
            ...(org.contrato ? { contrato: { create: { ...org.contrato, clausulas: [...org.contrato.clausulas] } } } : {}),
          },
        });
        idsOrganizacoes.push(criada.id);
      }

      const sequencias = new Map<TipoEquipamento, number>();

      for (const lote of LOTES) {
        const idOrganizacao = idsOrganizacoes[lote.organizacao];
        if (idOrganizacao === undefined) throw new Error("Organização inválida no seed");

        const dataEntrada = diasAtras(lote.diasAtras);
        const criado = await tx.lote.create({
          data: {
            organizacaoId: idOrganizacao,
            dataEntrada,
            notaFiscal: lote.notaFiscal,
            transportadora: lote.transportadora,
            statusProcessamento: lote.status,
            observacoes: lote.observacoes,
          },
        });

        let posicao = 0;
        for (const eq of lote.equipamentos) {
          posicao += 1;
          const sequencia = (sequencias.get(eq.tipo) ?? 0) + 1;
          sequencias.set(eq.tipo, sequencia);

          const equipamento = await tx.equipamento.create({
            data: {
              loteId: criado.id,
              posicaoNoLote: posicao,
              codigoBarrasInterno: gerarCodigoBarras(eq.tipo, sequencia),
              tipo: eq.tipo,
              marca: eq.marca,
              modelo: eq.modelo,
              anoFabricacao: eq.ano,
              estadoFisico: eq.estado,
              statusRastreamento: eq.status,
              pesoQuilogramas: eq.peso,
            },
          });

          let origem = "Entrada";
          let momento = dataEntrada.getTime();
          for (const destino of eq.movimentacoes ?? []) {
            momento += 3_600_000; // uma hora entre movimentações
            await tx.movimentacao.create({
              data: {
                equipamentoId: equipamento.id,
                dataHora: new Date(momento),
                origem,
                destino,
                responsavel: "gestor",
              },
            });
            origem = destino;
          }
        }
      }
    },
    { timeout: 60_000 },
  );

  console.log(
    `Dados demonstrativos criados: ${ORGANIZACOES.length} organizações, ${LOTES.length} lotes.`,
  );
}

async function main() {
  await criarUsuariosEConfiguracao();
  await criarDadosDemonstrativos();

  console.log("Seed concluído. Usuários de desenvolvimento:");
  for (const u of USUARIOS) {
    console.log(`  ${u.usuario.padEnd(9)} ${u.senha.padEnd(16)} ${u.papel}`);
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());