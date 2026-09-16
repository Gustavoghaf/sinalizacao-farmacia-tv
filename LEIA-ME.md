# Sinalização Digital — Farmácia (v2)

Sistema com painel de controle para gerenciar as ofertas exibidas na TV, e um modo para tocar playlists do YouTube (útil para usar a caixa de som conectada via Bluetooth na TV).

## O que você precisa

- Um computador (o mesmo PC da farmácia) que fique ligado durante o expediente.
- **Node.js** instalado nesse PC (versão 18 ou mais recente). Baixe em: https://nodejs.org (escolha a versão "LTS").
- PC e TV conectados na mesma rede Wi-Fi/rede local.

## Instalação (só precisa fazer uma vez)

1. Copie a pasta `sinalizacao-farmacia-v2` inteira para o computador da farmácia.
2. Abra um terminal (PowerShell/CMD no Windows, Terminal no Mac) dentro dessa pasta.
3. Rode:
   ```
   npm install
   ```
   Isso baixa as bibliotecas necessárias (só precisa rodar de novo se copiar o projeto para outro PC).

## Usando todo dia

1. No terminal, dentro da pasta do projeto, rode:
   ```
   npm start
   ```
   O terminal vai mostrar dois endereços, algo como:
   ```
   No PC/celular (painel de controle):
     http://localhost:4173/admin.html

   Na TV (tela de exibição), use o IP da máquina, ex:
     http://192.168.0.15:4173/display.html
   ```
2. Na **TV**, abra o navegador dela e digite o endereço de "tela de exibição" (o que tem o IP, tipo `http://192.168.0.15:4173/display.html`). Deixe essa aba aberta — é o que vai ficar na tela o dia todo.
3. No **PC** (ou no celular, desde que esteja na mesma rede Wi-Fi), abra o endereço do painel de controle (`http://localhost:4173/admin.html` no PC, ou `http://192.168.0.15:4173/admin.html` no celular).
4. Deixe o terminal aberto enquanto estiver usando o sistema — é ele que mantém tudo funcionando. Se fechar o terminal, o sistema para.

> Dica: para não precisar abrir o terminal toda vez, dá pra configurar o Node para iniciar junto com o Windows/Mac. Se quiser ajuda com isso, é só pedir.

## Como usar o painel

- **Adicionar ofertas**: arraste fotos/vídeos para a caixa de upload, ou toque nela para escolher os arquivos. Eles são organizados automaticamente na pasta `media/` do projeto.
- **Reordenar**: use as setinhas ▲ ▼ ao lado de cada item.
- **Tempo de exibição**: só se aplica a imagens (vídeos tocam até o fim sozinhos). Edite o número de segundos e ele salva automaticamente.
- **Exibir agora**: clique no ícone de play ⏵ de um item pra trocar imediatamente o que está na TV.
- **Excluir**: ícone de lixeira 🗑 — remove da playlist e apaga o arquivo.
- **Música de fundo**: cole o link de uma playlist do YouTube no campo da seção "Música de fundo" e clique em "Salvar e tocar na TV", ou ligue a chavinha depois de já ter uma playlist salva. As ofertas **continuam tocando normalmente na tela** — a música só toca por cima, sem interromper nada. Use "⏮ Anterior" e "Próxima ⏭" para pular faixas a qualquer momento.

## Sobre o som do YouTube

O áudio da playlist sai pela própria TV. Como a TV já está pareada via Bluetooth com a caixa de som da farmácia, o som vai automaticamente para ela — isso é gerenciado pela própria TV, não precisa configurar nada no sistema.

**Importante — vídeos "indisponíveis":** alguns vídeos do YouTube têm a incorporação em outros sites bloqueada pelo próprio dono (comum em clipes oficiais/Vevo). Quando isso acontece, aparece "vídeo não disponível" e o sistema pula automaticamente para a próxima faixa da playlist, sem travar. Playlists de "áudio oficial", lyric videos ou compilações costumam ter menos bloqueios que clipes oficiais — se muitas faixas de uma playlist estiverem sendo puladas, vale tentar uma playlist diferente.

**Se a música não começar a tocar sozinha:** alguns navegadores só liberam áudio com som depois de uma primeira interação na própria tela (um toque na tela da TV, ou um clique com o controle/mouse, se houver). Isso costuma ser necessário só uma vez por sessão — depois de interagir uma vez, deve continuar funcionando normalmente enquanto a página não for recarregada.

**Alternativa mais simples e robusta:** se o YouTube der muito trabalho (anúncios, vídeos bloqueados, política de autoplay), uma opção mais direta é comprar um adaptador Bluetooth USB para o PC (custa pouco, geralmente entre R$20 e R$40). Assim o próprio computador conecta direto na caixa de som, sem depender da TV nem do YouTube, e dá pra tocar qualquer app de música do PC. Isso resolveria o problema original — liberar o celular — de forma mais simples, caso o modo YouTube não fique satisfatório no dia a dia.

## Formatos aceitos

- Vídeos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Imagens: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

## Solução de problemas

- **A TV não abre o painel/tela**: confirme que PC e TV estão na mesma rede Wi-Fi, e que o endereço com o IP (não `localhost`) foi digitado certinho na TV.
- **O IP mudou e a TV parou de atualizar**: alguns roteadores trocam o IP do PC de vez em quando. Se isso acontecer, rode `npm start` de novo e veja o novo endereço no terminal.
- **Quero usar em outra porta**: rode `PORT=5000 npm start` (troque 5000 pelo número desejado).
