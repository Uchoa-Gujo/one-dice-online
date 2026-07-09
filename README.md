# One Dice Site v1.95.30 — atributos sem camada sobre editor e modo denso fixo

## Resumo
Esta atualização corrige o problema em que, depois de reduzir e expandir o módulo **Atributos**, o card resumido continuava aparecendo por cima do editor.  
Também remove o botão **Modo Confortável / Modo Denso**, deixando o **modo denso sempre ativo**, como solicitado.

## O que foi corrigido

- Ao expandir **Atributos**, a camada reduzida é ocultada completamente.
- O editor original dos atributos volta a ficar livre e clicável.
- Não foi alterado o design do editor expandido.
- O modo reduzido continua existindo somente quando o módulo está reduzido.
- O botão **Modo Confortável / Modo Denso** foi removido da barra de organização.
- O site passa a manter o **modo denso ativo** automaticamente.

## Limpezas realizadas e motivo

### 1. Camada reduzida presa sobre o editor

**O que foi limpo:**  
A camada `.od1715-attr-summary` agora é forçada a sumir quando o módulo de atributos não está reduzido.

**Por que foi limpo:**  
Depois de reduzir e expandir, o resumo visual podia continuar com `display: grid` preso por estilo inline ou por render antigo. Isso fazia o card resumido aparecer por cima do editor real.

**Como foi substituído:**  
Foi criado um sincronizador específico que observa o estado do módulo:
- se estiver reduzido, mostra apenas o resumo;
- se estiver expandido, esconde completamente o resumo e libera o editor original.

### 2. Botão Modo Confortável / Modo Denso

**O que foi removido:**  
O botão `#od170-dense-toggle` e qualquer botão recriado com texto “Modo confortável”, “Modo confortavel” ou “Modo denso”.

**Por que foi removido:**  
O usuário pediu para manter somente o modo denso ativo e remover a opção visual de alternância.

**Como foi substituído:**  
O modo denso agora é aplicado diretamente com `od170-dense-sheet` e salvo como ativo no armazenamento local.

## Arquivos alterados

- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar

1. Abrir uma ficha.
2. Ir em **Atributos**.
3. Confirmar que o editor expandido aparece normal.
4. Clicar em **Reduzir**.
5. Confirmar que aparece o resumo.
6. Clicar em **Expandir**.
7. Confirmar que o resumo não fica por cima do editor.
8. Confirmar que o botão **Modo Confortável / Modo Denso** não aparece mais.
9. Confirmar que a ficha continua em modo denso.

## Observação importante
Esta atualização não mexe em login, boot, cookies, socket, criação/exclusão de ficha, menu de três traços ou design do editor expandido.
