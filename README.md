# One Dice Site v1.95.3

## Foco

Hotfix de campanha, combate, chat, Owlbear, boot pós-login e polimento visual.

## Correções principais

- Reduzidas travas e vai-e-volta do scroll dentro de campanhas;
- removido o quadrado/retângulo antigo do canto superior direito em campanha;
- corrigido flicker de botões dentro da campanha;
- link Owlbear reforçado dentro do editor de campanha;
- botões Owlbear passam a abrir o link configurado da mesa;
- botão “Criar mapa Owlbear” continua abrindo https://www.owlbear.rodeo/;
- chat da campanha ganha avatar/foto em estilo Discord;
- chat passa a ter cache local para não sumir ao trocar de aba/atualizar;
- corrigida aba/visual antigo piscando ao voltar para a campanha ou configurar Owlbear;
- combat screen ajustada para participantes e ordem de turno não quebrarem;
- mestre pode adicionar nome/NPC manual na ordem;
- iniciar/encerrar combate reforçados;
- jogadores só conseguem rolar iniciativa com combate iniciado;
- menu dos três tracinhos na ficha vira apenas botão, sem retângulo grande atrás;
- boot pós-login reforçado para não precisar de F5;
- removido/ocultado Histórico Curto das fichas;
- arredondamentos corrigidos para evitar fundo quadrado vazando nas quinas.

## Validação

- `npm run check`;
- `client/script.js`;
- `client/obs.js`;
- `server/server.js`;
- `server/database.js`;
- `server/middleware.js`;
- `server/routes/auth.js`;
- `server/routes/characters.js`;
- `server/routes/tables.js`;
- `server/sockets/index.js`.

## Versão

1.95.3
