ALTER TABLE `ConfiguracaoGlobal`
  DROP CHECK `chk_config_valor_base`,
  ADD CONSTRAINT `chk_config_valor_base`
    CHECK (`valorBaseDepreciacao` > 0);