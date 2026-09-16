// ============================================================
// Sinalização Digital — Farmácia (v2)
// Servidor local: painel de controle + tela da TV + áudio de fundo (YouTube)
// ============================================================

const express = require('express');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const MEDIA_DIR = path.join(ROOT, 'media');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

// -------------------- Preparação de pastas --------------------
for (const dir of [MEDIA_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// -------------------- Estado persistido --------------------
// A playlist de ofertas (fotos/vídeos) e o áudio de fundo (YouTube)
// agora são independentes: a TV sempre mostra as ofertas, e o áudio
// toca por cima, ligado ou desligado, sem interromper a exibição.
const DEFAULT_STATE = {
  playlist: [],                 // [{ id, type: 'video'|'image', filename, duration }]
  audio: {
    enabled: false,
    youtubePlaylistId: '',
  },
};

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      audio: { ...DEFAULT_STATE.audio, ...(parsed.audio || {}) },
    };
  } catch (err) {
    return { ...DEFAULT_STATE, audio: { ...DEFAULT_STATE.audio } };
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

let state = loadState();

// -------------------- App / servidor HTTP --------------------
const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use('/media', express.static(MEDIA_DIR, { maxAge: '1h' }));
app.use(express.static(path.join(ROOT, 'public')));

// -------------------- Upload de arquivos --------------------
const ALLOWED_VIDEO = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const ALLOWED_IMAGE = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .slice(0, 60);
    const unique = crypto.randomBytes(3).toString('hex');
    cb(null, `${base || 'arquivo'}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB por arquivo
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_VIDEO.has(ext) || ALLOWED_IMAGE.has(ext)) cb(null, true);
    else cb(new Error(`Tipo de arquivo não suportado: ${ext}`));
  },
});

// -------------------- WebSocket (tempo real) --------------------
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', state }));
  ws.on('error', () => {});
});

// -------------------- Rotas da API --------------------

// Estado atual completo (usado no carregamento inicial das páginas)
app.get('/api/state', (req, res) => {
  res.json(state);
});

// Informações de rede, pra facilitar achar o endereço da TV/celular
app.get('/api/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  res.json({ addresses, port: PORT });
});

// Upload de um ou mais arquivos
app.post('/api/upload', upload.array('arquivos', 20), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
  }

  const novosItens = req.files.map((file) => {
    const ext = path.extname(file.filename).toLowerCase();
    const type = ALLOWED_VIDEO.has(ext) ? 'video' : 'image';
    return {
      id: crypto.randomUUID(),
      type,
      filename: file.filename,
      duration: type === 'image' ? 8000 : null,
    };
  });

  state.playlist.push(...novosItens);
  saveState();
  broadcast({ type: 'state', state });
  res.json({ ok: true, items: novosItens });
});

// Reordenar a playlist de ofertas (recebe a lista completa de ids na nova ordem)
app.post('/api/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Lista de ordem inválida.' });

  const byId = new Map(state.playlist.map((item) => [item.id, item]));
  const reordered = order.map((id) => byId.get(id)).filter(Boolean);

  if (reordered.length !== state.playlist.length) {
    return res.status(400).json({ error: 'A lista enviada não bate com a playlist atual.' });
  }

  state.playlist = reordered;
  saveState();
  broadcast({ type: 'state', state });
  res.json({ ok: true });
});

// Editar duração de um item (só faz sentido pra imagens)
app.put('/api/item/:id', (req, res) => {
  const item = state.playlist.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado.' });

  if (typeof req.body.duration === 'number' && req.body.duration >= 1000) {
    item.duration = Math.round(req.body.duration);
  }
  saveState();
  broadcast({ type: 'state', state });
  res.json({ ok: true, item });
});

// Remover um item (apaga também o arquivo da pasta media)
app.delete('/api/item/:id', (req, res) => {
  const idx = state.playlist.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item não encontrado.' });

  const [removido] = state.playlist.splice(idx, 1);
  const filePath = path.join(MEDIA_DIR, removido.filename);
  fs.unlink(filePath, () => {}); // best-effort, ignora erro se já não existir

  saveState();
  broadcast({ type: 'state', state });
  res.json({ ok: true });
});

// Trocar agora mesmo qual oferta está sendo exibida na TV
app.post('/api/jump', (req, res) => {
  const { id } = req.body;
  const index = state.playlist.findIndex((i) => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item não encontrado.' });

  broadcast({ type: 'jump', index });
  res.json({ ok: true });
});

// Ligar/desligar o áudio de fundo e/ou trocar a playlist do YouTube.
// As ofertas continuam sendo exibidas normalmente, o áudio só toca por cima.
app.post('/api/audio', (req, res) => {
  const { enabled, youtubePlaylistId } = req.body;

  if (typeof enabled === 'boolean') state.audio.enabled = enabled;
  if (typeof youtubePlaylistId === 'string') state.audio.youtubePlaylistId = youtubePlaylistId.trim();

  saveState();
  broadcast({ type: 'state', state });
  res.json({ ok: true, audio: state.audio });
});

// Avançar ou voltar uma faixa na playlist do YouTube que está tocando na TV
app.post('/api/audio/skip', (req, res) => {
  const { direction } = req.body;
  if (!['next', 'prev'].includes(direction)) {
    return res.status(400).json({ error: 'Direção inválida.' });
  }
  broadcast({ type: 'audio-skip', direction });
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

server.listen(PORT, () => {
  console.log('==================================================');
  console.log('  Sinalização Digital — Farmácia');
  console.log(`  Servidor rodando na porta ${PORT}`);
  console.log('');
  console.log('  No PC/celular (painel de controle):');
  console.log(`    http://localhost:${PORT}/admin.html`);
  console.log('');
  console.log('  Na TV (tela de exibição), use o IP da máquina, ex:');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`    http://${iface.address}:${PORT}/display.html`);
      }
    }
  }
  console.log('==================================================');
});
