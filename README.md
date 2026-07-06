# One Dice Site v1.95.19 — recuperação estável

## Resumo

Esta versão é uma **recuperação limpa** baseada na última versão informada como funcionando normalmente: **v1.95.8 — campanha sem flicker, combate e chat**.

O objetivo desta atualização não é tentar remendar a sequência quebrada. O objetivo é devolver o site para uma base estável, removendo o risco das alterações feitas depois da v1.95.8.

## Decisão técnica

A base do código-fonte foi restaurada a partir do ZIP enviado como última versão funcional:

- `one-dice-site-v1958-campanha-sem-flicker-combate-chat (1).zip`

A partir dela, foi gerada a versão **1.95.19** apenas com atualização de identificação de versão e cache busting.

## O que foi feito

- Restaurado o código-fonte da versão **v1.95.8**.
- Atualizado `package.json` para **1.95.19**.
- Atualizados os parâmetros de cache do `client/index.html` para carregar `style.css` e `script.js` como **v1.95.19**.
- Atualizado o marcador `window.ONE_DICE_CLIENT_VERSION` no `client/script.js` para **1.95.19**.
- Mantido o código funcional da v1.95.8 sem reaplicar os blocos problemáticos das versões posteriores.
- Atualizado este `README.md` com a recuperação e o motivo.

## O que foi removido/descartado

### 1. Sequência de patches v1.95.10 até v1.95.18

**O que foi descartado:**  
As alterações feitas depois da v1.95.8 não foram reaplicadas nesta recuperação.

**Por que foi descartado:**  
O carregamento infinito começou após essa sequência de alterações. Como o problema continuou mesmo após várias tentativas de correção, a decisão segura foi abandonar essa linha de patches e voltar para a última base funcional confirmada.

**Como foi substituído:**  
Foi usada a v1.95.8 como fonte real de estabilidade. Novas correções devem ser feitas uma por vez a partir desta base, com testes após cada mudança.

### 2. Correções agressivas de boot/loading feitas nas versões quebradas

**O que foi descartado:**  
Intervenções em boot, loaders, Socket.IO, restauração de sessão, timeout global e proteções visuais feitas nas versões posteriores.

**Por que foi descartado:**  
Essas alterações não resolveram o problema no ambiente real e aumentaram o risco de mascarar a causa, além de modificar áreas sensíveis do carregamento geral do site.

**Como foi substituído:**  
A recuperação volta ao comportamento original estável da v1.95.8.

## Correções preservadas da base v1.95.8

- Campanha com menos flicker.
- Owlbear persistente.
- Chat com altura fixa e scroll interno.
- Render ao vivo preservando posição do scroll.
- Ordem de turno redesenhada em blocos compactos.
- Destaque do personagem do turno atual.
- Botão `Limpar` deixando combate em `Aguardando combate`.
- Controle de iniciativa liberado apenas após iniciar combate.
- Mestre pode expulsar jogadores na aba Jogadores.
- Status, iniciativa manual, remover e focar turno reforçados.
- Redução de flicker por renderização simultânea/socket/polling.

## Como testar

1. Subir esta versão no servidor.
2. Fazer hard refresh no navegador.
3. Testar em aba anônima ou navegador limpo.
4. Verificar se a tela de login aparece sem a aba ficar girando infinitamente.
5. Entrar com uma conta existente.
6. Acessar Personagens.
7. Acessar Campanhas.
8. Entrar em uma ficha.
9. Entrar em uma campanha/mesa.
10. Verificar se o chat, combate e rolagens continuam funcionando como na v1.95.8.

## Próxima regra de trabalho

A partir desta recuperação, qualquer correção deve ser aplicada em patch pequeno e isolado:

1. Uma mudança por vez.
2. Sem mexer em boot/login/socket se o bug não for dessas áreas.
3. Sem MutationObserver global.
4. Sem loader global novo.
5. Sem recriar fluxo antigo por cima.
6. Testar depois de cada correção antes de avançar para a próxima.

## Versão

1.95.19
