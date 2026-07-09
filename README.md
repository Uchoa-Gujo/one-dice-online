# One Dice Site v1.95.25 — design do menu da ficha baseado na referência

## Resumo
Esta versão continua em cima da base estável recuperada e mexe somente no visual do menu aberto pelo botão de três linhas dentro da ficha.

## O que foi feito
- Atualizei o design do painel do menu da ficha para ficar mais próximo da imagem de referência enviada.
- Aumentei o painel aberto, com borda vermelha fina, cantos mais arredondados e fundo escuro feito apenas com gradientes CSS.
- Ajustei o botão de três linhas para o modelo vermelho arredondado maior da referência.
- Organizei os comandos em grade de 2 colunas e 3 linhas:
  - Mesas;
  - Vincular em Mesa;
  - Vermelho;
  - Fonte Medieval;
  - OBS;
  - Sair da Mesa.
- Apliquei botões escuros com borda cinza nos comandos neutros.
- Apliquei borda vermelha no botão Vincular em Mesa.
- Apliquei preenchimento vermelho no botão Sair da Mesa.
- Mantive o menu sem flicker da versão v1.95.24.
- Mantive os atributos resumidos no formato nome, valor e bônus.

## O que foi limpo/removido
### 1. Tema escuro e histórico dentro do menu da ficha
**O que foi removido visualmente:**
O botão Tema Escuro e o botão Histórico continuam fora do layout visual do menu da ficha.

**Motivo:**
A referência enviada mostra apenas seis blocos principais. Manter botões extras aumentaria o retângulo e quebraria o padrão visual pedido.

### 2. Fundo por imagem antiga
**O que foi evitado:**
Não foi usada a imagem antiga de fundo no painel do menu.

**Motivo:**
Ela já tinha causado vazamento visual em Firefox e dentro da ficha. A textura atual é feita somente com CSS, sem depender de arquivo de imagem.

## Arquivos alterados
- `client/style.css`
- `client/script.js`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar
1. Abrir uma ficha.
2. Clicar no botão de três linhas.
3. Conferir se o painel fica parecido com a referência: borda vermelha, fundo escuro, botão vermelho no canto e seis blocos em duas colunas.
4. Fechar e abrir novamente para confirmar que não voltou o flicker.
5. Testar no Firefox e no navegador principal.

## Observação
Não mexi em login, boot, cookies, socket, criação de ficha ou exclusão de ficha nesta atualização.
