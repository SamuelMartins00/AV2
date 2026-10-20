-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario` VARCHAR(191) NOT NULL,
    `hashSenha` VARCHAR(191) NOT NULL,
    `papel` ENUM('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR') NOT NULL,
    `ultimoAcesso` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_usuario_key`(`usuario`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `revogado` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organizacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `razaoSocial` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NOT NULL,
    `inscricaoEstadual` VARCHAR(191) NULL,
    `enderecoCompleto` TEXT NOT NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `dataCadastro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Organizacao_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contrato` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizacaoId` INTEGER NOT NULL,
    `dataAssinatura` DATETIME(3) NOT NULL,
    `dataVencimento` DATETIME(3) NOT NULL,
    `clausulas` JSON NOT NULL,
    `valorMensal` DECIMAL(12, 2) NOT NULL,
    `renovacaoAutomatica` BOOLEAN NOT NULL DEFAULT false,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Contrato_organizacaoId_key`(`organizacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizacaoId` INTEGER NOT NULL,
    `dataEntrada` DATETIME(3) NOT NULL,
    `notaFiscal` VARCHAR(191) NOT NULL,
    `transportadora` VARCHAR(191) NOT NULL,
    `statusProcessamento` ENUM('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO') NOT NULL DEFAULT 'RECEBIDO',
    `observacoes` TEXT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    INDEX `Lote_organizacaoId_idx`(`organizacaoId`),
    INDEX `Lote_dataEntrada_idx`(`dataEntrada`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigoBarrasInterno` VARCHAR(191) NOT NULL,
    `loteId` INTEGER NOT NULL,
    `posicaoNoLote` INTEGER NOT NULL,
    `tipo` ENUM('COMPUTADOR_MESA', 'NOTEBOOK', 'MONITOR', 'IMPRESSORA', 'SERVIDOR', 'ROTEADOR', 'CABO_ESTRUTURADO', 'FONTE_ALIMENTACAO') NOT NULL,
    `marca` VARCHAR(191) NOT NULL,
    `modelo` VARCHAR(191) NOT NULL,
    `anoFabricacao` INTEGER NOT NULL,
    `estadoFisico` ENUM('NOVO', 'BOM_ESTADO', 'USADO_LEVE', 'USADO_MODERADO', 'DANIFICADO_LEVE', 'DANIFICADO_GRAVE', 'INSERVIVEL') NOT NULL,
    `statusRastreamento` ENUM('AGUARDANDO_TRIAGEM', 'EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO', 'BAIXA_DEFINITIVA') NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    `pesoQuilogramas` DECIMAL(8, 3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Equipamento_codigoBarrasInterno_key`(`codigoBarrasInterno`),
    UNIQUE INDEX `Equipamento_loteId_posicaoNoLote_key`(`loteId`, `posicaoNoLote`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Movimentacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipamentoId` INTEGER NOT NULL,
    `dataHora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `origem` VARCHAR(191) NOT NULL,
    `destino` VARCHAR(191) NOT NULL,
    `responsavel` VARCHAR(191) NOT NULL,
    `observacao` TEXT NULL,

    INDEX `Movimentacao_equipamentoId_idx`(`equipamentoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalTransacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operacao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `dadosAntes` JSON NULL,
    `dadosDepois` JSON NULL,
    `usuarioResponsavel` VARCHAR(191) NOT NULL,

    INDEX `JournalTransacao_timestamp_idx`(`timestamp`),
    INDEX `JournalTransacao_entidade_idx`(`entidade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConfiguracaoGlobal` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `aliquotaImpostos` DECIMAL(5, 4) NOT NULL DEFAULT 0.18,
    `coeficienteDepreciacao` DECIMAL(5, 4) NOT NULL DEFAULT 0.2,
    `valorBaseDepreciacao` DECIMAL(12, 2) NOT NULL DEFAULT 1000,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contrato` ADD CONSTRAINT `Contrato_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lote` ADD CONSTRAINT `Lote_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipamento` ADD CONSTRAINT `Equipamento_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `Lote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movimentacao` ADD CONSTRAINT `Movimentacao_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `Equipamento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
