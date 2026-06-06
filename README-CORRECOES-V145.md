# One Dice Site v1.45 - Hotfix anti-carregamento infinito

Correções:

- O site não entra mais automaticamente na última mesa salva no navegador durante o boot.
- O vínculo de mesa salvo no localStorage é limpo ao abrir a home segura.
- Socket.IO só conecta depois que o usuário entra manualmente em uma mesa.
- O boot tem timeout e volta para a tela de mesas/fichas caso a API demore.
- Entrada manual em mesa também tem timeout e retorna com alerta em vez de travar.

Motivo:

A tela podia ficar presa em uma mesa antiga/cacheada mesmo com o servidor e Docker funcionando.
