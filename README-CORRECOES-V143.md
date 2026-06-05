# One Dice Site v1.43 — correções solicitadas

Correções aplicadas nesta versão:

1. Defesa e Esquiva foram reforçadas como campos manuais independentes. Ao editar Defesa, Esquiva não é mais alterada; ao editar Esquiva, Defesa não é mais alterada.
2. Removido o texto "Manual" que aparecia/piscava abaixo de Defesa e Esquiva.
3. Ao abrir uma ficha pelo menu de fichas da conta, ela abre como ficha separada da conta, não dentro da sessão/campanha vinculada.
4. Ao excluir uma campanha/sessão, os vínculos de fichas são removidos automaticamente no cliente e no servidor.
5. Se uma campanha apagada ainda estava em cache local, os membros/fichas órfãs são limpos e a tela volta para o menu de campanhas.
6. O sistema de restauração mantém no máximo 5 backups por ficha.
7. A barra rápida fica oculta por padrão e pode ser mostrada/ocultada pelo menu de três traços.
8. O perfil da sessão agora é clicável e abre as configurações da conta.

Validação executada:

- node --check client/script.js
- node --check server/routes/tables.js
- node --check server/server.js
