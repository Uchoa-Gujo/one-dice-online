# One Dice Online v115 — Manutenção e Otimização

Esta versão é um update de manutenção geral em cima da v114.

## Ajustes principais

- Versão centralizada pelo `package.json` no servidor.
- Rotas formais adicionadas para `/inicio`, `/personagens`, `/campanhas`, `/mesas`, `/fichas`, `/ficha/:id` e `/mesa/:id`.
- Headers de cache organizados para HTML/JS/CSS e assets.
- Índices adicionais no banco para melhorar busca de fichas, membros e mensagens.
- Logs de requisição opcionais com `LOG_REQUESTS=true`.
- Polling de mensagens/drops reduzido de 5s para 12s.
- Microanimações otimizadas com respeito a `prefers-reduced-motion`.
- Sons leves de interface com botão de ligar/desligar no menu da engrenagem.
- Limpeza segura de chaves antigas de cache local.
- Textos de API formalizados em alguns pontos.

## Observação

Não foi feita refatoração total do `client/script.js`, porque ele ainda concentra muitos patches históricos. A limpeza profunda deve ser feita por módulos em uma versão futura para evitar quebrar login, fichas, campanhas ou mesa ao vivo.
