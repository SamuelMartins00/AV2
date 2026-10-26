-- Prompt 3: triagem individual e baixa definitiva. A migração é aditiva.
-- Resultado histórico permanece NULL; não inferimos decisões de triagem anteriores.
ALTER TABLE `Equipamento`
    ADD COLUMN `resultadoTriagem` ENUM(
      'AGUARDANDO_AVALIACAO',
      'APROVADO_PARA_DESMONTAGEM',
      'DESTINADO_AO_REAPROVEITAMENTO_DE_PECAS',
      'DESTINADO_A_RECICLAGEM',
      'DESTINADO_AO_DESCARTE_SEGURO'
    ) NULL,
    ADD COLUMN `triagemResponsavel` VARCHAR(191) NULL,
    ADD COLUMN `triagemEm` DATETIME(3) NULL,
    ADD COLUMN `triagemJustificativa` TEXT NULL,
    ADD COLUMN `baixadoEm` DATETIME(3) NULL,
    ADD COLUMN `baixaResponsavel` VARCHAR(191) NULL,
    ADD COLUMN `baixaJustificativa` TEXT NULL;

CREATE INDEX `Equipamento_resultadoTriagem_idx` ON `Equipamento`(`resultadoTriagem`);
