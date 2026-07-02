# One Dice Site v1.94.0

## Foco

Integração básica com Owlbear Rodeo.

A ideia desta versão é não criar mapa/grid dentro do One Dice. O One Dice continua sendo o centro de campanha, fichas, combate, permissões e chat, enquanto o Owlbear Rodeo fica responsável pelo mapa de batalha.

## O que foi adicionado

### Card de Mapa Owlbear no Gerenciador da Campanha

Dentro da campanha aparece um card de **Mapa de Batalha Externo** com:

- botão **Abrir Mapa**;
- botão **Copiar Link**;
- botão **Ir para Owlbear**;
- aviso de que fichas, combate e chat continuam no One Dice.

### Configuração pelo mestre

O mestre pode configurar:

- link da sala Owlbear;
- link de cena/mapa específico, opcional;
- nota rápida para jogadores.

### Editor de Campanha

O Editor de Campanha completo ganhou uma seção **Mapa**, com os mesmos campos da integração Owlbear.

### Salvamento

Os dados são salvos em `tables.settings`:

- `owlbearEnabled`;
- `owlbearUrl`;
- `owlbearRoomUrl`;
- `owlbearSceneUrl`;
- `owlbearNote`.

## Como usar

1. O mestre cria ou abre uma sala no Owlbear Rodeo.
2. Copia o link da sala.
3. Cola o link no One Dice.
4. Salva o mapa.
5. Jogadores clicam em **Abrir Mapa** para ir ao Owlbear.

## Importante

Esta versão não cria extensão Owlbear, não controla tokens e não tenta manipular mapa. É apenas a integração básica por link, mais segura e estável.

## Versão

1.94.0
