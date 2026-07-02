# One Dice Site v1.95.1

## Foco

Hotfix da v1.95 para corrigir problemas dentro da campanha depois da validação de camadas.

## Correções principais

- Corrigido reset de scroll dentro da campanha.
- Renderizações do gerenciador agora preservam posição de scroll.
- Abertura de ficha foi refeita para não cair no modelo antigo.
- Botões de ficha da campanha e da aba Personagens agora usam uma ponte estável.
- Botão Voltar da campanha agora volta direto para `/campanhas`, sem tela preta.
- Camada de ficha remove o gerenciador da campanha antes de carregar a ficha.
- Corrigida resolução/overflow dentro da campanha.
- Escondido o botão antigo das três setas dentro da campanha.
- Reforçada a remoção visual dos controles antigos na camada campanha.

## Validação

Validar:

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

1.95.1
