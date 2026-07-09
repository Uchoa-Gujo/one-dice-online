# One Dice Site v1.95.26 — atributos resumidos em ordem vertical

## Resumo
Esta versão continua em cima da base estável atual e mexe somente no design dos **atributos resumidos** dentro da ficha.

## O que foi feito
- Recriei o render dos cards resumidos de atributos.
- O card agora segue a ordem pedida:
  - nome do atributo centralizado;
  - valor cheio do atributo centralizado;
  - bônus do atributo centralizado abaixo, dentro do design.
- Removi a composição visual antiga que deixava nome, valor e bônus na mesma linha.
- Mantive os nomes completos:
  - FORÇA;
  - AGILIDADE;
  - VIGOR;
  - INTELECTO;
  - PRESENÇA.
- Mantive o visual escuro/vermelho dos cards.
- Mantive o menu da ficha sem flicker da v1.95.24.
- Mantive o design do menu da ficha da v1.95.25.

## O que foi limpo/removido
### 1. Layout horizontal antigo dos atributos resumidos
**O que foi removido visualmente:**
A estrutura onde o nome do atributo ficava à esquerda, o valor no centro/lado e o bônus encaixado na mesma linha.

**Motivo:**
Esse modelo deixava o card apertado e diferente do formato solicitado. O pedido atual é um bloco em coluna: nome, valor e bônus.

**Como foi substituído:**
Foi criado um render novo para os atributos resumidos usando cards `od19526-attr-card`, com os três elementos centralizados e em ordem vertical fixa.

### 2. Competição com renderizações antigas
**O que foi neutralizado:**
Renderizações antigas de atributos que ainda podiam reaparecer depois de troca de aba ou re-render da ficha.

**Motivo:**
Algumas camadas antigas do projeto ainda tentavam recriar os atributos em formatos anteriores.

**Como foi substituído:**
A versão v1.95.26 registra o render novo como render principal dos atributos e reaplica o modelo somente quando o grid de atributos é recriado.

## Arquivos alterados
- `client/style.css`
- `client/script.js`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar
1. Abrir uma ficha.
2. Ir na aba **Resumo**.
3. Conferir a área **Atributos**.
4. Cada card deve aparecer assim:
   - nome do atributo no topo;
   - número grande no centro;
   - bônus abaixo dentro da cápsula vermelha.
5. Trocar de aba e voltar para **Resumo** para confirmar que o layout não volta ao modelo antigo.

## Observação
Não mexi em login, boot, cookies, socket, exclusão de ficha, criação de ficha ou menu da ficha nesta atualização.
