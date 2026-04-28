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

// ===== 心跳检测（防止僵尸连接） =====
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
  const roomId = genId(4);  // 4位房间码，如 AB3K
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
  // 房主不能取消准备
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

  broadcast(room, { type: 'gameStarted', players, turnTime: msg.turnTime || 0 });
  broadcast(room, { type: 'gameSync' });
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
    action:      msg.action,
    gems:        msg.gems,
    cardId:      msg.cardId,
    fromReserved: msg.fromReserved || false,
    goldSub:     msg.goldSub || 0,
    fromDeck:    msg.fromDeck || false,
    deckLevel:   msg.deckLevel || 0
  });
}

function handleChat(ws, msg, info) {
  if (!info) return;
  const room = rooms.get(info.roomId);
  if (!room) return;
  const text = String(msg.text || '').substring(0, 100);
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
    if (getOnlineCount(room) === 0) {
      rooms.delete(info.roomId);
      console.log('[房间] 已销毁:', info.roomId);
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
  for (const c of room.clients) {
    if (c.readyState === WebSocket.OPEN) {
      c.send(data);
    }
  }
}

function broadcastRoomState(room) {
  const onlineClients = getOnlineClients(room);
  const players = onlineClients.map((c, i) => {
    const ci = connMap.get(c);
    return { id: ci.playerId, name: ci.name, ready: room.readySet.has(ci.playerId), isHost: i === 0 };
  });
  const hostInfo = onlineClients.length ? connMap.get(onlineClients[0]) : null;
  broadcast(room, { type: 'roomState', players, hostId: hostInfo ? hostInfo.playerId : null });
}

function getOnlineClients(room) {
  return room.clients.filter(c => c.readyState === WebSocket.OPEN);
}

function getOnlineCount(room) {
  return getOnlineClients(room).length;
}

function sanitizeName(name) {
  name = String(name || '').trim();
  if (!name) name = '玩家' + Math.floor(Math.random() * 100);
  if (name.length > 10) name = name.substring(0, 10);
  return name;
}

// ===== 启动服务器 =====
server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ 璀璨宝石云端服务器运行中，端口:', PORT);
});
