-- Alterações aditivas para gestão de usuários. Nenhuma conta ou relação é removida.
ALTER TABLE `Usuario`
    ADD COLUMN `nomeExibicao` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `senhaAlteracaoObrigatoria` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `versaoSeguranca` INTEGER NOT NULL DEFAULT 1;

-- Preserva os registros existentes, usando o login como nome inicial.
UPDATE `Usuario` SET `nomeExibicao` = `usuario` WHERE `nomeExibicao` = '';

ALTER TABLE `Usuario` MODIFY COLUMN `nomeExibicao` VARCHAR(191) NOT NULL;

CREATE INDEX `Usuario_ativo_papel_idx` ON `Usuario`(`ativo`, `papel`);
