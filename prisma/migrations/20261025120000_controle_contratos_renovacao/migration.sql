-- Etapa 2 do Prompt 2: extensões aditivas para contratos e controle de renovação.
-- Não preenche duração histórica por suposição, não renova/encerra contratos e não altera o journal.

ALTER TABLE `Contrato`
    ADD COLUMN `duracaoRenovacaoMeses` INTEGER NULL,
    ADD COLUMN `encerradoEm` DATETIME(3) NULL,
    ADD COLUMN `motivoEncerramento` TEXT NULL;

CREATE TABLE `OperacaoRenovacaoAutomatica` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contratoId` INTEGER NOT NULL,
    `vencimentoOriginal` DATETIME(3) NOT NULL,
    `estado` ENUM('PENDENTE', 'PROCESSANDO', 'AGUARDANDO_NOVA_TENTATIVA', 'CONCLUIDA', 'INTERVENCAO_MANUAL') NOT NULL DEFAULT 'PENDENTE',
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `tentativaIniciadaEm` DATETIME(3) NULL,
    `reivindicacaoExpiraEm` DATETIME(3) NULL,
    `ultimaTentativaEm` DATETIME(3) NULL,
    `proximaTentativaEm` DATETIME(3) NULL,
    `concluidaEm` DATETIME(3) NULL,
    `ultimaFalhaResumo` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OperacaoRenovacaoAutomatica_contratoId_vencimentoOriginal_key` (`contratoId`, `vencimentoOriginal`),
    INDEX `OperacaoRenovacaoAutomatica_estado_proximaTentativaEm_idx` (`estado`, `proximaTentativaEm`),
    INDEX `OperacaoRenovacaoAutomatica_estado_reivindicacaoExpiraEm_idx` (`estado`, `reivindicacaoExpiraEm`),
    INDEX `OperacaoRenovacaoAutomatica_contratoId_idx` (`contratoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OperacaoRenovacaoAutomatica`
    ADD CONSTRAINT `OperacaoRenovacaoAutomatica_contratoId_fkey`
    FOREIGN KEY (`contratoId`) REFERENCES `Contrato`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
