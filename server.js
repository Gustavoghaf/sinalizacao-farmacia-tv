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
const DISPLAYS_FILE = path.join(DATA_DIR, 'displays.json');

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
    const merged = {
      ...DEFAULT_STATE,
      ...parsed,
      audio: { ...DEFAULT_STATE.audio, ...(parsed.audio || {}) },
    };
    // migração: itens salvos antes de existir o campo "enabled"/"name" ganham valores padrão
    merged.playlist = (merged.playlist || []).map((item) => ({
      ...item,
      enabled: item.enabled !== false,
      name: item.name || item.filename,
    }));
    return merged;
  } catch (err) {
    return { ...DEFAULT_STATE, audio: { ...DEFAULT_STATE.audio } };
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

let state = loadState();

// -------------------- Telas conectadas (displays) --------------------
// Cada tela (TV) que abre display.html se identifica com um id próprio e
// manda atualizações periódicas do que está exibindo. Isso fica só em
// memória (reseta quando o servidor reinicia — as telas se registram de
// novo sozinhas), exceto o nome que a farmácia dá a cada tela, que é
// salvo em disco pra não se perder.
function loadDisplayLabels() {
  try {
    return JSON.parse(fs.readFileSync(DISPLAYS_FILE, 'utf-8'));
  } catch (err) {
    return {};
  }
}
function saveDisplayLabels() {
  fs.writeFileSync(DISPLAYS_FILE, JSON.stringify(displayLabels, null, 2), 'utf-8');
}
let displayLabels = loadDisplayLabels(); // { [displayId]: label }
const displays = new Map(); // displayId -> { id, label, connected, lastSeen, status }

function displaysList() {
  return Array.from(displays.values()).map((d) => ({
    id: d.id,
    label: d.label,
    connected: d.connected,
    lastSeen: d.lastSeen,
    status: d.status,
  }));
}

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

function broadcastDisplays() {
  broadcast({ type: 'displays', displays: displaysList() });
}

// Manda uma mensagem só pra uma tela específica (usado pra avançar/voltar/pausar vídeo)
function sendToDisplay(displayId, message) {
  const payload = JSON.stringify(message);
  let found = false;
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.displayId === displayId) {
      client.send(payload);
      found = true;
    }
  });
  return found;
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', state }));
  ws.send(JSON.stringify({ type: 'displays', displays: displaysList() }));
  ws.isDisplay = false;
  ws.displayId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      return;
    }

    if (msg.type === 'register-display' && typeof msg.displayId === 'string') {
      ws.isDisplay = true;
      ws.displayId = msg.displayId;
      const existing = displays.get(msg.displayId);
      displays.set(msg.displayId, {
        id: msg.displayId,
        label: displayLabels[msg.displayId] || (existing && existing.label) || `TV ${displays.size + 1}`,
        connected: true,
        lastSeen: Date.now(),
        status: existing ? existing.status : null,
      });
      broadcastDisplays();
    } else if (msg.type === 'display-status' && ws.displayId) {
      const d = displays.get(ws.displayId);
      if (d) {
        d.status = msg.status;
        d.lastSeen = Date.now();
        d.connected = true;
        broadcastDisplays();
      }
    }
  });

  ws.on('close', () => {
    if (ws.displayId) {
      const d = displays.get(ws.displayId);
      if (d) {
        d.connected = false;
        d.lastSeen = Date.now();
        broadcastDisplays();
      }
    }
  });

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
    const originalBase = path.basename(file.originalname, path.extname(file.originalname));
    return {
      id: crypto.randomUUID(),
      type,
      filename: file.filename,
      name: originalBase || file.filename,
      duration: type === 'image' ? 8000 : null,
      enabled: true,
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
  if (typeof req.body.enabled === 'boolean') {
    item.enabled = req.body.enabled;
  }
  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    item.name = req.body.name.trim().slice(0, 80);
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
  const exists = state.playlist.some((i) => i.id === id);
  if (!exists) return res.status(404).json({ error: 'Item não encontrado.' });

  broadcast({ type: 'jump', id });
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

// -------------------- Rotas das telas conectadas --------------------

// Lista todas as telas já vistas (conectadas ou não)
app.get('/api/displays', (req, res) => {
  res.json(displaysList());
});

// Renomear uma tela (ex: "TV Balcão", "TV Vitrine")
app.put('/api/displays/:id', (req, res) => {
  const { label } = req.body;
  if (typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'Nome inválido.' });
  }
  const trimmed = label.trim().slice(0, 40);
  displayLabels[req.params.id] = trimmed;
  saveDisplayLabels();
  const d = displays.get(req.params.id);
  if (d) d.label = trimmed;
  broadcastDisplays();
  res.json({ ok: true, label: trimmed });
});

// Remove uma tela da lista (só permite se ela não estiver mais conectada)
app.delete('/api/displays/:id', (req, res) => {
  const d = displays.get(req.params.id);
  if (d && d.connected) {
    return res.status(400).json({ error: 'Essa tela ainda está conectada.' });
  }
  displays.delete(req.params.id);
  delete displayLabels[req.params.id];
  saveDisplayLabels();
  broadcastDisplays();
  res.json({ ok: true });
});

// Pula pra um instante específico do vídeo que está tocando numa tela
app.post('/api/displays/:id/seek', (req, res) => {
  const { time } = req.body;
  if (typeof time !== 'number' || time < 0) {
    return res.status(400).json({ error: 'Tempo inválido.' });
  }
  const sent = sendToDisplay(req.params.id, { type: 'seek', time });
  if (!sent) return res.status(404).json({ error: 'Tela não está conectada agora.' });
  res.json({ ok: true });
});

// Pausa ou retoma o vídeo que está tocando numa tela
app.post('/api/displays/:id/playback', (req, res) => {
  const { action } = req.body;
  if (!['play', 'pause'].includes(action)) {
    return res.status(400).json({ error: 'Ação inválida.' });
  }
  const sent = sendToDisplay(req.params.id, { type: 'playback', action });
  if (!sent) return res.status(404).json({ error: 'Tela não está conectada agora.' });
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
