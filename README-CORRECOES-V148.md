# One Dice Site v1.48 - rollback seguro

Esta versão volta a base para a v1.42, que era a última versão estável antes do bug de abertura travada da mesa.

## O que foi mantido
- Estrutura e navegação da v1.42.
- Correções de estabilidade já existentes até a v1.42.

## O que foi aplicado de forma segura
- Textos auxiliares "Manual" de Defesa/Esquiva ocultados via CSS/patch leve.
- Backups locais limitados a 5 por ficha.
- Versão/cache atualizado para 1.48.0.

## O que foi removido em relação à v1.43+
- Sobrescritas de initAccountCharacterEditor.
- Guardas agressivos de enterCampaign.
- Limpeza automática de campanhas/membros no boot.
- Watchdogs que forçavam tela/hub.

Essas partes foram as mais prováveis causadoras da tela travada em mesa vazia.
