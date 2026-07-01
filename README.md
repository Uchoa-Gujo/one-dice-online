# One Dice Site v1.90.1

## Foco da atualização

Reformulação da parte interna das campanhas/mesas.

A entrada da campanha agora abre um **Gerenciador de Campanha** separado da ficha, com abas próprias no estilo de sites como LitchRPG/Roll20.

## Novo fluxo interno

Ao clicar em **Acessar** em uma campanha, o sistema abre o novo gerenciador com as abas:

1. Personagens;
2. Combate;
3. Jogadores;
4. Chat;
5. Escudo.

## Aba Personagens

Mostra todos os personagens da campanha com:

- retrato;
- nome;
- raça/classe/nível;
- jogador dono;
- entrada na mesa.

Para o mestre, aparecem ações:

- Acessar Ficha;
- OBS;
- Remover jogador da mesa.

Para jogadores, aparece apenas o acesso permitido à própria ficha.

## Aba Combate

Nova preparação de combate:

- lista personagens participantes;
- botão **Rolar Iniciativa**;
- ordem de turno organizada automaticamente;
- mestre pode iniciar/encerrar combate;
- mestre pode limpar a ordem de iniciativa.

Os jogadores podem rolar iniciativa no menu de combate.
Também foi adicionado botão de iniciativa dentro da ficha quando aberta pela campanha.

## Aba Jogadores

Mostra as contas vinculadas à campanha:

- nome da conta;
- função;
- entrada;
- status online/offline local.

## Aba Chat

Chat ao vivo da campanha com mensagens dos jogadores.

## Aba Escudo

Disponível apenas para o mestre.

Mostra:

- foto do personagem;
- nome;
- jogador;
- PV;
- PE;
- acesso rápido à ficha.

## Limpeza de camadas antigas

O novo gerenciador assume o fluxo interno da campanha e oculta o app-grid antigo da ficha/painel enquanto estiver no gerenciamento.

O banco/localStorage não foi apagado para não destruir campanhas já criadas. A limpeza foi feita no fluxo visual e de renderização para evitar sobreposição com as camadas antigas.

## Versão

1.90.1
