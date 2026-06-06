# One Dice Site v1.51.0 — rebuild limpo do cliente

Esta versão substitui o `client/script.js` por uma implementação limpa, sem as camadas antigas acumuladas que estavam sobrescrevendo funções e causando loading infinito/flicker.

Principais mudanças:

- Removidas as camadas antigas do cliente no `script.js`.
- Removido carregamento de `/socket.io/socket.io.js` no HTML, pois o cliente limpo não abre socket automático.
- Defesa e Esquiva agora são campos independentes reais.
- A aba Personagens abre ficha avulsa, sem entrar na mesa automaticamente.
- O hub de Mesas/Fichas é renderizado por uma única lógica.
- Sem MutationObservers globais, setIntervals legados ou watchers de interface.
- Backups locais limitados a 5 por ficha.
- Duplicar ficha mantido.
- Perfil da sessão abre Configurações da Conta.

Observação: algumas funções muito específicas das camadas antigas podem ter sido removidas de propósito para recuperar estabilidade. Reintroduza recursos apenas em módulos separados e testados.
