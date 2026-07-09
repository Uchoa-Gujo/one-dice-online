# One Dice Site v1.95.24 — menu da ficha sem flicker e painel compacto

## Resumo

Esta versão corrige apenas o tópico atual da ficha: o menu de três traços que estava piscando e o retângulo do menu que estava grande demais.

A base continua sendo a recuperação estável derivada da v1.95.8. Não foram feitas alterações em login, boot, socket, cookies, banco ou loader.

## Correções feitas

- Corrigi o flicker/piscada do botão de três traços dentro da ficha.
- Corrigi a causa provável do botão sumir e voltar: estados antigos de campanha/mesa ainda podiam marcar a tela como campanha mesmo na rota `/personagem/...`.
- A rota `/personagem` e `/ficha` agora tem prioridade sobre classes/datasets antigos.
- Removi o loop contínuo da v1.95.23 que reaplicava o menu a cada 900ms.
- O menu agora é controlado por classes estáveis no `body/html`, não por um intervalo visual constante.
- O botão de três traços foi reduzido para 38x38px.
- O painel aberto foi compactado:
  - largura reduzida;
  - padding reduzido;
  - botões mais próximos;
  - blocos centralizados;
  - altura total menor.
- Mantive a área de atributos resumidos no formato pedido:
  - nome do atributo centralizado;
  - valor cheio centralizado;
  - bônus centralizado embaixo dentro do design.

## Arquivos alterados

- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Remoção do intervalo contínuo da v1.95.23

**O que foi removido:**  
Foi removido o `setInterval(syncAll, 900)` que ficava reaplicando o estado do menu da ficha repetidamente.

**Por que foi removido:**  
Esse intervalo brigava visualmente com scripts antigos que ainda mexiam no `main-topbar`. Em algumas contas/navegadores isso causava o efeito de piscar: o menu era escondido por um bloco antigo e reaparecia quando o intervalo novo rodava de novo.

**Como foi substituído:**  
Agora o menu usa classes fixas no `html/body` e um `MutationObserver` leve apenas para reagir quando algum script antigo tentar alterar classe/estilo do menu. Não existe mais loop visual constante.

### 2. Correção da detecção de tela da ficha

**O que foi limpo:**  
A verificação antiga tratava estados de campanha/mesa como prioridade. Isso podia fazer o sistema pensar que a ficha era campanha por alguns instantes.

**Por que foi limpo:**  
Quando isso acontecia, o botão era ocultado e depois recriado, gerando flicker.

**Como foi substituído:**  
A rota `/personagem` ou `/ficha` agora tem prioridade. Se o navegador está numa ficha, o menu da ficha permanece ativo mesmo que algum dataset antigo ainda tente dizer que é campanha.

### 3. Compactação do retângulo do menu

**O que foi ajustado:**  
O painel aberto do menu foi reduzido de tamanho e os botões internos foram centralizados em uma grade compacta.

**Por que foi ajustado:**  
O retângulo estava grande demais para a quantidade de botões e deixava muito espaço vazio.

**Como foi substituído:**  
A largura máxima foi reduzida, o padding foi diminuído e os botões/selects agora usam altura menor e ficam mais próximos.

## Como testar

1. Abrir uma ficha pelo navegador principal.
2. Confirmar que o botão de três traços permanece visível sem piscar.
3. Clicar no botão e confirmar que o menu abre.
4. Esperar alguns segundos com o menu aberto e confirmar que ele não pisca.
5. Fechar no próprio botão de três traços.
6. Abrir novamente e verificar se o retângulo ficou menor e os botões ficaram mais centralizados.
7. Repetir no Firefox.

## Observação

Esta versão resolve só o tópico atual do menu, como combinado. Os outros bugs devem ser tratados um por vez para evitar quebrar novamente a base estável.
