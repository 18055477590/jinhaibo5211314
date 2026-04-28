/**
 * 璀璨宝石 - 云端 WebSocket 游戏服务器
 * 支持跨网络多人联机对战
 * 部署到 Railway.app / Render.com 等免费平台
 */
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8765;

// 房间和连接数据
const rooms = new Map();   // roomId -> Room
const connMap = new Map(); // WebSocket -> ConnInfo

function genId(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ===== 游戏数据定义 =====
const CARD_DATA = [
  // Lv1 (40张)
  { id:101,cost:{white:0,blue:1,green:0,red:1,black:0},points:0,bonus:'blue',level:1 },
  { id:102,cost:{white:0,blue:0,green:1,red:1,black:0},points:0,bonus:'green',level:1 },
  { id:103,cost:{white:1,blue:1,green:0,red:0,black:0},points:0,bonus:'white',level:1 },
  { id:104,cost:{white:1,blue:0,green:1,red:0,black:0},points:0,bonus:'green',level:1 },
  { id:105,cost:{white:0,blue:1,green:0,red:0,black:1},points:0,bonus:'black',level:1 },
  { id:106,cost:{white:1,blue:1,green:1,red:0,black:0},points:0,bonus:'white',level:1 },
  { id:107,cost:{white:0,blue:0,green:1,red:1,black:1},points:0,bonus:'red',level:1 },
  { id:108,cost:{white:1,blue:1,green:0,red:1,black:0},points:0,bonus:'blue',level:1 },
  { id:109,cost:{white:1,blue:0,green:0,red:1,black:1},points:0,bonus:'black',level:1 },
  { id:110,cost:{white:0,blue:1,green:1,red:1,black:0},points:0,bonus:'green',level:1 },
  { id:111,cost:{white:1,blue:1,green:1,red:0,black:0},points:0,bonus:'blue',level:1 },
  { id:112,cost:{white:0,blue:1,green:1,red:0,black:1},points:0,bonus:'blue',level:1 },
  { id:113,cost:{white:1,blue:0,green:1,red:1,black:0},points:0,bonus:'red',level:1 },
  { id:114,cost:{white:1,blue:1,green:0,red:1,black:0},points:0,bonus:'green',level:1 },
  { id:115,cost:{white:0,blue:0,green:1,red:1,black:1},points:0,bonus:'green',level:1 },
  { id:116,cost:{white:1,blue:1,green:0,red:0,black:1},points:0,bonus:'white',level:1 },
  { id:117,cost:{white:0,blue:1,green:0,red:1,black:1},points:0,bonus:'red',level:1 },
  { id:118,cost:{white:1,blue:0,green:1,red:0,black:1},points:0,bonus:'black',level:1 },
  { id:119,cost:{white:1,blue:1,green:1,red:0,black:0},points:0,bonus:'black',level:1 },
  { id:120,cost:{white:0,blue:0,green:1,red:1,black:1},points:0,bonus:'blue',level:1 },
  { id:121,cost:{white:1,blue:1,green:0,red:1,black:0},points:0,bonus:'red',level:1 },
  { id:122,cost:{white:0,blue:1,green:1,red:0,black:1},points:0,bonus:'green',level:1 },
  { id:123,cost:{white:1,blue:0,green:0,red:1,black:1},points:0,bonus:'white',level:1 },
  { id:124,cost:{white:0,blue:1,green:0,red:1,black:1},points:0,bonus:'black',level:1 },
  { id:125,cost:{white:1,blue:1,green:1,red:0,black:0},points:0,bonus:'red',level:1 },
  { id:126,cost:{white:1,blue:0,green:1,red:1,black:0},points:0,bonus:'blue',level:1 },
  { id:127,cost:{white:0,blue:1,green:1,red:1,black:0},points:0,bonus:'white',level:1 },
  { id:128,cost:{white:1,blue:1,green:0,red:0,black:1},points:0,bonus:'green',level:1 },
  { id:129,cost:{white:0,blue:0,green:1,red:1,black:1},points:0,bonus:'white',level:1 },
  { id:130,cost:{white:1,blue:1,green:0,red:1,black:0},points:0,bonus:'black',level:1 },
  { id:131,cost:{white:0,blue:1,green:0,red:0,black:1},points:0,bonus:'red',level:1 },
  { id:132,cost:{white:1,blue:0,green:0,red:0,black:1},points:0,bonus:'blue',level:1 },
  { id:133,cost:{white:0,blue:0,green:0,red:1,black:1},points:0,bonus:'green',level:1 },
  { id:134,cost:{white:0,blue:0,green:1,red:0,black:1},points:0,bonus:'red',level:1 },
  { id:135,cost:{white:0,blue:1,green:0,red:1,black:0},points:0,bonus:'black',level:1 },
  { id:136,cost:{white:1,blue:0,green:0,red:1,black:0},points:0,bonus:'red',level:1 },
  { id:137,cost:{white:0,blue:0,green:0,red:1,black:1},points:0,bonus:'blue',level:1 },
  { id:138,cost:{white:1,blue:1,green:0,red:0,black:0},points:0,bonus:'black',level:1 },
  { id:139,cost:{white:0,blue:0,green:1,red:1,black:0},points:0,bonus:'white',level:1 },
  { id:140,cost:{white:0,blue:1,green:0,red:0,black:1},points:0,bonus:'green',level:1 },
  // Lv2 (30张)
  { id:201,cost:{white:0,blue:2,green:2,red:0,black:1},points:1,bonus:'blue',level:2 },
  { id:202,cost:{white:2,blue:0,green:0,red:2,black:1},points:1,bonus:'white',level:2 },
  { id:203,cost:{white:1,blue:2,green:0,red:2,black:0},points:1,bonus:'red',level:2 },
  { id:204,cost:{white:2,blue:1,green:2,red:0,black:0},points:1,bonus:'green',level:2 },
  { id:205,cost:{white:0,blue:0,green:2,red:2,black:2},points:1,bonus:'black',level:2 },
  { id:206,cost:{white:1,blue:0,green:2,red:2,black:0},points:1,bonus:'green',level:2 },
  { id:207,cost:{white:2,blue:2,green:0,red:0,black:1},points:1,bonus:'white',level:2 },
  { id:208,cost:{white:0,blue:1,green:2,red:2,black:0},points:1,bonus:'red',level:2 },
  { id:209,cost:{white:2,blue:2,green:0,red:1,black:0},points:1,bonus:'blue',level:2 },
  { id:210,cost:{white:0,blue:2,green:0,red:2,black:2},points:1,bonus:'black',level:2 },
  { id:211,cost:{white:2,blue:0,green:2,red:1,black:0},points:1,bonus:'green',level:2 },
  { id:212,cost:{white:1,blue:2,green:2,red:0,black:0},points:1,bonus:'blue',level:2 },
  { id:213,cost:{white:0,blue:2,green:2,red:0,black:1},points:1,bonus:'green',level:2 },
  { id:214,cost:{white:2,blue:0,green:0,red:2,black:2},points:1,bonus:'red',level:2 },
  { id:215,cost:{white:1,blue:1,green:2,red:2,black:0},points:1,bonus:'white',level:2 },
  { id:216,cost:{white:2,blue:2,green:0,red:0,black:2},points:1,bonus:'black',level:2 },
  { id:217,cost:{white:0,blue:1,green:2,red:0,black:2},points:1,bonus:'green',level:2 },
  { id:218,cost:{white:2,blue:0,green:2,red:2,black:0},points:1,bonus:'red',level:2 },
  { id:219,cost:{white:2,blue:2,green:1,red:0,black:0},points:1,bonus:'blue',level:2 },
  { id:220,cost:{white:0,blue:2,green:0,red:2,black:1},points:1,bonus:'black',level:2 },
  { id:221,cost:{white:1,blue:0,green:2,red:0,black:2},points:1,bonus:'green',level:2 },
  { id:222,cost:{white:2,blue:1,green:0,red:2,black:0},points:1,bonus:'red',level:2 },
  { id:223,cost:{white:0,blue:2,green:1,red:2,black:0},points:1,bonus:'white',level:2 },
  { id:224,cost:{white:2,blue:0,green:2,red:0,black:2},points:1,bonus:'black',level:2 },
  { id:225,cost:{white:0,blue:0,green:2,red:2,black:1},points:1,bonus:'green',level:2 },
  { id:226,cost:{white:2,blue:1,green:0,red:0,black:2},points:1,bonus:'blue',level:2 },
  { id:227,cost:{white:1,blue:2,green:0,red:2,black:0},points:1,bonus:'red',level:2 },
  { id:228,cost:{white:0,blue:2,green:2,red:1,black:0},points:1,bonus:'green',level:2 },
  { id:229,cost:{white:2,blue:0,green:0,red:2,black:1},points:1,bonus:'black',level:2 },
  { id:230,cost:{white:1,blue:1,green:2,red:0,black:2},points:1,bonus:'white',level:2 },
  // Lv3 (20张)
  { id:301,cost:{white:3,blue:3,green:0,red:0,black:3},points:3,bonus:'white',level:3 },
  { id:302,cost:{white:0,blue:3,green:3,red:3,black:0},points:3,bonus:'blue',level:3 },
  { id:303,cost:{white:3,blue:0,green:0,red:3,black:3},points:3,bonus:'green',level:3 },
  { id:304,cost:{white:0,blue:0,green:3,red:3,black:3},points:3,bonus:'red',level:3 },
  { id:305,cost:{white:3,blue:3,green:3,red:0,black:0},points:3,bonus:'black',level:3 },
  { id:306,cost:{white:0,blue:3,green:0,red:3,black:3},points:3,bonus:'blue',level:3 },
  { id:307,cost:{white:3,blue:0,green:3,red:0,black:3},points:3,bonus:'green',level:3 },
  { id:308,cost:{white:3,blue:3,green:0,red:3,black:0},points:3,bonus:'white',level:3 },
  { id:309,cost:{white:0,blue:0,green:3,red:3,black:3},points:3,bonus:'red',level:3 },
  { id:310,cost:{white:3,blue:3,green:0,red:0,black:3},points:3,bonus:'black',level:3 },
  { id:311,cost:{white:3,blue:0,green:3,red:3,black:0},points:3,bonus:'blue',level:3 },
  { id:312,cost:{white:0,blue:3,green:3,red:0,black:3},points:3,bonus:'green',level:3 },
  { id:313,cost:{white:3,blue:3,green:3,red:0,black:0},points:3,bonus:'white',level:3 },
  { id:314,cost:{white:0,blue:0,green:3,red:3,black:3},points:3,bonus:'black',level:3 },
  { id:315,cost:{white:3,blue:3,green:0,red:3,black:0},points:3,bonus:'red',level:3 },
  { id:316,cost:{white:5,blue:0,green:0,red:0,black:0},points:4,bonus:'white',level:3 },
  { id:317,cost:{white:0,blue:5,green:0,red:0,black:0},points:4,bonus:'blue',level:3 },
  { id:318,cost:{white:0,blue:0,green:5,red:0,black:0},points:4,bonus:'green',level:3 },
  { id:319,cost:{white:0,blue:0,green:0,red:5,black:0},points:4,bonus:'red',level:3 },
  { id:320,cost:{white:0,blue:0,green:0,red:0,black:5},points:4,bonus:'black',level:3 },
];

const NOBLE_DATA = [
  { id:1, required:{white:4,blue:0,green:0,red:0,black:0}, points:3, image:'nobles/noble01.svg' },
  { id:2, required:{white:0,blue:4,green:0,red:0,black:0}, points:3, image:'nobles/noble02.svg' },
  { id:3, required:{white:0,blue:0,green:4,red:0,black:0}, points:3, image:'nobles/noble03.svg' },
  { id:4, required:{white:0,blue:0,green:0,red:4,black:0}, points:3, image:'nobles/noble04.svg' },
  { id:5, required:{white:0,blue:0,green:0,red:0,black:4}, points:3, image:'nobles/noble05.svg' },
  { id:6, required:{white:3,blue:3,green:0,red:0,black:0}, points:3, image:'nobles/noble06.svg' },
  { id:7, required:{white:3,blue:0,green:0,red:3,black:0}, points:3, image:'nobles/noble07.svg' },
  { id:8, required:{white:0,blue:3,green:3,red:0,black:0}, points:3, image:'nobles/noble08.svg' },
  { id:9, required:{white:0,blue:0,green:3,red:3,black:0}, points:3, image:'nobles/noble09.svg' },
  { id:10,required:{white:0,blue:0,green:0,red:3,black:3}, points:3, image:'nobles/noble10.svg' },
];

// ===== 游戏状态生成 =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initGameState(players) {
  // 洗牌
  const lv1Deck = shuffle(CARD_DATA.filter(c => c.level === 1));
  const lv2Deck = shuffle(CARD_DATA.filter(c => c.level === 2));
  const lv3Deck = shuffle(CARD_DATA.filter(c => c.level === 3));
  const nobleDeck = shuffle(NOBLE_DATA);

  // 桌面展示卡（每级4张 + 1张背面代表牌库）
  const shown = { level1: lv1Deck.slice(0, 4), level2: lv2Deck.slice(0, 4), level3: lv3Deck.slice(0, 4) };
  const decks  = { level1: lv1Deck.slice(4), level2: lv2Deck.slice(4), level3: lv3Deck.slice(4) };

  // 初始银行：每色4个 + 黄金5个
  const bankGems = { white:4, blue:4, green:4, red:4, black:4, gold:5 };

  // 初始贵族（根据玩家数量）
  const numNobles = players.length === 2 ? 2 : players.length;
  const nobles = nobleDeck.slice(0, numNobles);

  // 玩家初始状态
  const gamePlayers = players.map(p => ({
    id: p.id,
    name: p.name,
    points: 0,
    gems: { white:0, blue:0, green:0, red:0, black:0, gold:0 },
    cards: [],
    reserved: []
  }));

  return {
    players: gamePlayers,
    board: { shown, decks },
    nobles,
    bankGems,
    currentTurn: 0,
    phase: 'playing'
  };
}

// ===== HTTP 服务 =====
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Splendor Game Server OK - rooms: ' + rooms.size);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ===== WebSocket 服务 =====
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  console.log('[连接] 新连接，当前总连接:', wss.clients.size);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, msg);
    } catch (e) {
      console.error('[错误] 消息解析失败:', e.message);
    }
  });

  ws.on('close', () => handleClose(ws));
  ws.on('error', (err) => console.error('[WS错误]', err.message));
});

// ===== 心跳检测 =====
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      handleClose(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

// ===== 消息处理 =====
function handleMessage(ws, msg) {
  const { type } = msg;
  const info = connMap.get(ws);
  console.log('[消息]', type, '|', info ? info.name : '未注册');

  switch (type) {
    case 'createRoom':  handleCreateRoom(ws, msg); break;
    case 'joinRoom':    handleJoinRoom(ws, msg); break;
    case 'getRooms':    handleGetRooms(ws); break;
    case 'setReady':    handleSetReady(ws, msg, info); break;
    case 'startGame':   handleStartGame(ws, msg, info); break;
    case 'kickPlayer':  handleKickPlayer(ws, msg, info); break;
    case 'action':      handleAction(ws, msg, info); break;
    case 'chat':        handleChat(ws, msg, info); break;
    default: break;
  }
}

function handleCreateRoom(ws, msg) {
  const name = sanitizeName(msg.name);
  const roomId = genId(4);
  const playerId = genId(6);

  const room = {
    id: roomId,
    status: 'waiting',
    clients: [ws],
    readySet: new Set([playerId])
  };
  rooms.set(roomId, room);
  connMap.set(ws, { playerId, roomId, name });

  send(ws, { type: 'roomCreated', roomId, playerId, name });
  broadcastRoomState(room);
  console.log('[房间] 创建:', roomId, '房主:', name);
}

function handleJoinRoom(ws, msg) {
  const roomId = (msg.roomId || '').toUpperCase().trim();
  const name = sanitizeName(msg.name);
  const room = rooms.get(roomId);

  if (!room) {
    send(ws, { type: 'error', msg: '房间码 "' + roomId + '" 不存在，请核对' });
    return;
  }
  if (room.status !== 'waiting') {
    send(ws, { type: 'error', msg: '该房间游戏已开始，无法加入' });
    return;
  }
  const onlineCount = getOnlineCount(room);
  if (onlineCount >= 4) {
    send(ws, { type: 'error', msg: '房间已满（最多4人）' });
    return;
  }

  const playerId = genId(6);
  room.clients.push(ws);
  connMap.set(ws, { playerId, roomId, name });

  send(ws, { type: 'joinedRoom', roomId, playerId, name });
  broadcastRoomState(room);
  console.log('[房间] 加入:', roomId, '玩家:', name);
}

function handleGetRooms(ws) {
  const list = [];
  for (const room of rooms.values()) {
    if (room.status === 'waiting') {
      const hostClient = room.clients.find(c => c.readyState === WebSocket.OPEN);
      const hostInfo = hostClient ? connMap.get(hostClient) : null;
      list.push({
        id: room.id,
        playerCount: getOnlineCount(room),
        maxPlayers: 4,
        hostName: hostInfo ? hostInfo.name : '未知'
      });
    }
  }
  send(ws, { type: 'roomList', rooms: list });
}

function handleSetReady(ws, msg, info) {
  if (!info) return;
  const room = rooms.get(info.roomId);
  if (!room || room.status !== 'waiting') return;

  const onlineClients = getOnlineClients(room);
  if (onlineClients.length > 0 && connMap.get(onlineClients[0])?.playerId === info.playerId) return;

  if (msg.ready) room.readySet.add(info.playerId);
  else room.readySet.delete(info.playerId);
  broadcastRoomState(room);
}

function handleStartGame(ws, msg, info) {
  if (!info) { send(ws, { type: 'error', msg: '未在房间中' }); return; }
  const room = rooms.get(info.roomId);
  if (!room) { send(ws, { type: 'error', msg: '房间不存在' }); return; }
  if (room.status !== 'waiting') { send(ws, { type: 'error', msg: '游戏已开始' }); return; }

  const onlineClients = getOnlineClients(room);
  if (!onlineClients.length) { send(ws, { type: 'error', msg: '无玩家' }); return; }

  const hostInfo = connMap.get(onlineClients[0]);
  if (!hostInfo || hostInfo.playerId !== info.playerId) {
    send(ws, { type: 'error', msg: '只有房主可以开始游戏' }); return;
  }
  if (onlineClients.length < 2) {
    send(ws, { type: 'error', msg: '至少需要2名玩家才能开始' }); return;
  }
  for (const c of onlineClients) {
    const ci = connMap.get(c);
    if (ci && ci.playerId !== info.playerId && !room.readySet.has(ci.playerId)) {
      send(ws, { type: 'error', msg: '还有玩家未点击准备' }); return;
    }
  }

  room.status = 'playing';
  room.readySet.clear();

  const players = onlineClients.map(c => {
    const ci = connMap.get(c);
    return { id: ci.playerId, name: ci.name };
  });

  // 初始化游戏状态
  room.gameState = initGameState(players);

  broadcast(room, { type: 'gameStarted', players, turnTime: msg.turnTime || 0 });
  // 发送 gameState 消息（客户端期望的消息类型）
  broadcast(room, { type: 'gameState', state: room.gameState });
  console.log('[游戏] 开始:', info.roomId, '玩家数:', players.length);
}

function handleKickPlayer(ws, msg, info) {
  if (!info) return;
  const room = rooms.get(info.roomId);
  if (!room || room.status !== 'waiting') return;

  const onlineClients = getOnlineClients(room);
  const hostInfo = connMap.get(onlineClients[0]);
  if (!hostInfo || hostInfo.playerId !== info.playerId) {
    send(ws, { type: 'error', msg: '只有房主可以踢人' }); return;
  }

  const targetWs = room.clients.find(c => connMap.get(c)?.playerId === msg.targetId);
  if (!targetWs) return;

  const targetInfo = connMap.get(targetWs);
  connMap.delete(targetWs);
  room.clients = room.clients.filter(c => c !== targetWs);

  send(targetWs, { type: 'kicked', msg: '你已被踢出房间' });
  try { targetWs.close(); } catch(e) {}

  broadcast(room, { type: 'playerLeft', playerId: msg.targetId, name: targetInfo?.name || '玩家', kicked: true });
  broadcastRoomState(room);
}

function handleAction(ws, msg, info) {
  if (!info) return;
  const room = rooms.get(info.roomId);
  if (!room || room.status !== 'playing') return;

  broadcast(room, {
    type: 'gameAction',
    playerId: info.playerId,
    action: msg.action,
    gems: msg.gems,
    cardId: msg.cardId,
    fromReserved: msg.fromReserved || false,
    goldSub: msg.goldSub || 0,
    fromDeck: msg.fromDeck || false,
    deckLevel: msg.deckLevel || 0
  });
}

function handleChat(ws, msg, info) {
  if (!info) return;
  const room = rooms.get(info.roomId);
  if (!room) return;

  let text = (msg.text || '').substring(0, 100);
  broadcast(room, { type: 'chat', name: info.name, text });
}

function handleClose(ws) {
  const info = connMap.get(ws);
  connMap.delete(ws);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  room.clients = room.clients.filter(c => c !== ws);

  if (room.status === 'waiting') {
    if (room.clients.filter(c => c.readyState === WebSocket.OPEN).length === 0) {
      rooms.delete(info.roomId);
    } else {
      broadcastRoomState(room);
    }
  } else {
    broadcast(room, { type: 'playerLeft', playerId: info.playerId, name: info.name });
  }
}

// ===== 工具函数 =====
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcast(room, obj) {
  const data = JSON.stringify(obj);
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function getOnlineClients(room) {
  return room.clients.filter(c => c.readyState === WebSocket.OPEN);
}

function getOnlineCount(room) {
  return getOnlineClients(room).length;
}

function sanitizeName(name) {
  name = String(name).trim();
  if (!name) name = '玩家' + Math.floor(Math.random() * 100);
  if (name.length > 10) name = name.substring(0, 10);
  return name;
}

function broadcastRoomState(room) {
  const onlineClients = room.clients.filter(c => c.readyState === WebSocket.OPEN);
  const players = onlineClients.map((c, i) => {
    const info = connMap.get(c);
    return {
      id: info.playerId,
      name: info.name,
      ready: room.readySet.has(info.playerId),
      isHost: i === 0
    };
  });
  const hostInfo = onlineClients.length > 0 ? connMap.get(onlineClients[0]) : null;
  broadcast(room, {
    type: 'roomState',
    players,
    hostId: hostInfo ? hostInfo.playerId : null
  });
}

server.listen(PORT, () => {
  console.log(`璀璨宝石服务器运行中，端口: ${PORT}`);
});
