# One Dice v1.44 - Hotfix Hostinger e carregamento

Correções principais:

- API do navegador agora tem timeout de segurança para não deixar a aba carregando indefinidamente.
- Entrada em campanha online agora consulta o servidor antes de validar cache local.
- Boot do site não fica preso tentando abrir campanha apagada ou inválida.
- Defesa e Esquiva receberam reforço final para permanecerem campos manuais independentes.
- Textos manuais abaixo de Defesa/Esquiva seguem ocultos.

Após subir na Hostinger, reinicie o Node/PM2 e limpe o cache do navegador.
