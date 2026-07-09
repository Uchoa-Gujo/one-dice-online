# One Dice Site v1.95.27 — atributos reduzidos no modelo vertical

## Resumo
Esta atualização corrige especificamente o módulo **reduzido** de atributos na ficha.
Na v1.95.26 o layout vertical foi aplicado no bloco expandido, mas o modo reduzido ainda permanecia no modelo antigo em linha.

## O que foi corrigido
- O modo **reduzido** dos atributos agora usa o layout em ordem vertical.
- Cada card reduzido agora mostra:
  1. **Nome do atributo** centralizado;
  2. **Valor do atributo** centralizado;
  3. **Bônus do atributo** centralizado abaixo, dentro do chip.
- Mantido o visual escuro/vermelho aprovado.
- Mantido o clique do atributo para rolagem.

## Limpezas realizadas e motivo

### 1. Render antigo do resumo reduzido
**O que foi removido:**
O HTML antigo do resumo reduzido que montava `small + strong + span` sem classes próprias, mantendo o layout antigo em linha.

**Por que foi removido:**
Porque a v1.95.26 acabou alterando o grid expandido, mas não o resumo reduzido. Assim, o bloco recolhido continuava no visual antigo e conflitava com o padrão pedido.

**Como foi substituído:**
O resumo reduzido agora gera um card com classes próprias para nome, valor e bônus (`od19527-attr-name`, `od19527-attr-value`, `od19527-attr-bonus`).

### 2. Estilo antigo do resumo reduzido
**O que foi limpo:**
O comportamento visual antigo do `.od1715-attr-mini` no modo reduzido foi sobrescrito para um layout vertical.

**Por que foi limpo:**
Porque o CSS anterior deixava nome, valor e bônus praticamente no mesmo eixo visual, contrariando o layout aprovado.

**Como foi substituído:**
Foi criada uma camada de CSS específica da v1.95.27 para o modo reduzido, preservando só o necessário e reorganizando os elementos em coluna.

## Arquivos alterados
- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar
1. Abrir uma ficha.
2. Ir ao módulo **Atributos**.
3. Clicar em **Reduzir/Expandir** até entrar no modo reduzido.
4. Confirmar que no modo reduzido cada card mostra:
   - nome do atributo em cima;
   - valor grande no centro;
   - bônus embaixo.
5. Confirmar que no modo expandido o comportamento existente continua funcionando.

## Observação
Esta atualização mexe **somente** no design do módulo reduzido de atributos.
Não altera login, boot, cookies, socket, menu da ficha, criação de ficha ou exclusão.
