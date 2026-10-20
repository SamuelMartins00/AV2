ALTER TABLE `Contrato`
  ADD CONSTRAINT `chk_contrato_datas` CHECK (`dataVencimento` > `dataAssinatura`),
  ADD CONSTRAINT `chk_contrato_valor` CHECK (`valorMensal` >= 0);

ALTER TABLE `Equipamento`
  ADD CONSTRAINT `chk_equipamento_peso` CHECK (`pesoQuilogramas` > 0),
  ADD CONSTRAINT `chk_equipamento_posicao` CHECK (`posicaoNoLote` > 0);

ALTER TABLE `ConfiguracaoGlobal`
  ADD CONSTRAINT `chk_config_aliquota` CHECK (`aliquotaImpostos` BETWEEN 0 AND 1),
  ADD CONSTRAINT `chk_config_coeficiente` CHECK (`coeficienteDepreciacao` BETWEEN 0 AND 1),
  ADD CONSTRAINT `chk_config_valor_base` CHECK (`valorBaseDepreciacao` >= 0);