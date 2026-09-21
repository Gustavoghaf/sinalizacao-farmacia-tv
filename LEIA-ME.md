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
- **Prévia**: cada item mostra uma miniatura (thumbnail) da foto ou do primeiro quadro do vídeo, pra facilitar identificar qual é qual.
- **Renomear**: clique no nome do item (é um campo editável) pra dar um nome mais claro do que o nome do arquivo original — por exemplo "Oferta Dipirona 500mg" em vez de "IMG_2384.jpg". O nome do arquivo original continua visível, pequeno, embaixo, só como referência.
- **Tempo de exibição**: só se aplica a imagens (vídeos tocam até o fim sozinhos). Edite o número de segundos e ele salva automaticamente.
- **Exibir/ocultar**: o ícone de olho 👁 tira o item da exibição na TV temporariamente, sem excluir — ele continua na lista, só marcado como oculto (ícone vira 🚫). Clique de novo pra ele voltar a aparecer. Útil pra pausar uma oferta específica sem perder o arquivo.
- **Exibir agora**: clique no ícone de play ⏵ de um item pra trocar imediatamente o que está na TV — funciona mesmo em itens ocultos, como uma prévia manual (depois ele volta ao ciclo normal dos itens visíveis).
- **Excluir**: ícone de lixeira 🗑 — remove da playlist e apaga o arquivo.
- **Música de fundo**: cole o link de uma playlist do YouTube no campo da seção "Música de fundo" e clique em "Salvar e tocar na TV", ou ligue a chavinha depois de já ter uma playlist salva. As ofertas **continuam tocando normalmente na tela** — a música só toca escondida por cima, sem interromper nada. Use "⏮ Anterior" e "Próxima ⏭" para pular faixas a qualquer momento.

## Telas conectadas (monitorar e controlar cada TV)

O painel tem uma seção "Telas conectadas" que mostra, em tempo real, cada TV que está com a tela de exibição aberta:

- **Nome**: cada TV aparece com um nome (tipo "TV 1"). Toque no ícone ✏️ pra renomear (ex: "TV Balcão", "TV Vitrine") — útil se a farmácia tiver mais de uma tela.
- **O que está exibindo**: mostra a miniatura e o nome da oferta em exibição naquela TV específica.
- **Vídeos em tempo real**: pra vídeos, aparece a barra de progresso com o tempo atual e total, atualizando sozinha. Dá pra:
  - Arrastar a barra pra qualquer ponto do vídeo (como no YouTube).
  - ⏪ Voltar 10 segundos / ⏩ Avançar 10 segundos.
  - ⏸ Pausar / ▶ Retomar.
- **Online/offline**: uma bolinha verde indica que a TV está conectada agora; se ficar cinza, mostra há quanto tempo ela caiu (pode ser a TV desligada, sem rede, ou a aba fechada). TVs desconectadas podem ser removidas da lista com o ícone 🗑.

Isso funciona mesmo com várias TVs ao mesmo tempo — cada uma aparece separada na lista, com seu próprio nome e controle independente.

## Sobre o som do YouTube

O áudio da playlist toca escondido na própria TV, por cima das ofertas. Como a TV já está pareada via Bluetooth com a caixa de som da farmácia, o som vai automaticamente para ela — isso é gerenciado pela própria TV, não precisa configurar nada no sistema.

**Importante — vídeos "indisponíveis":** alguns vídeos do YouTube têm a incorporação em outros sites bloqueada pelo próprio dono (comum em clipes oficiais/Vevo). Quando isso acontece, aparece "vídeo não disponível" e o sistema pula automaticamente para a próxima faixa da playlist, sem travar. Playlists de "áudio oficial", lyric videos ou compilações costumam ter menos bloqueios que clipes oficiais — se muitas faixas de uma playlist estiverem sendo puladas, vale tentar uma playlist diferente.

**Se a música não começar a tocar sozinha:** alguns navegadores só liberam áudio com som depois de uma primeira interação na própria tela (um toque na tela da TV, ou um clique com o controle/mouse, se houver). Isso costuma ser necessário só uma vez por sessão — depois de interagir uma vez, deve continuar funcionando normalmente enquanto a página não for recarregada.

**Aviso sobre TVs específicas:** algumas Smart TVs desenham vídeo incorporado numa camada de hardware que ignora completamente o CSS da página, fazendo o player de música "tomar conta" da tela por cima das ofertas, mesmo escondido no código. O sistema tenta evitar isso encolhendo o player a um tamanho mínimo e desativando tela cheia/atalhos, mas em algumas TVs mais teimosas isso pode não ser suficiente. Se isso acontecer na sua TV, as alternativas são: um adaptador Bluetooth USB no computador (toca a música do PC direto na caixa de som, sem depender da TV) ou manter o celular como fonte de áudio por enquanto.

## Formatos aceitos

- Vídeos: `.mp4`, `.webm`, `.mov`, `.m4v`
- Imagens: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

## Solução de problemas

- **A TV não abre o painel/tela**: confirme que PC e TV estão na mesma rede Wi-Fi, e que o endereço com o IP (não `localhost`) foi digitado certinho na TV.
- **O IP mudou e a TV parou de atualizar**: alguns roteadores trocam o IP do PC de vez em quando. Se isso acontecer, rode `npm start` de novo e veja o novo endereço no terminal.
- **Quero usar em outra porta**: rode `PORT=5000 npm start` (troque 5000 pelo número desejado).
