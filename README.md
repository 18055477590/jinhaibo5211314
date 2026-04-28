# 璀璨宝石 - 云端联机服务器

轻量级 WebSocket 游戏服务器，用于跨城市/跨网络联机对战。

## 免费部署到 Railway.app

### 步骤一：上传代码到 GitHub

1. 在 GitHub 创建一个新仓库（如 `splendor-server`）
2. 将本目录的文件上传：
   - `server.js`
   - `package.json`
   - `README.md`

### 步骤二：在 Railway.app 部署

1. 访问 https://railway.app/
2. 用 GitHub 账号登录
3. 点击 **「New Project」→「Deploy from GitHub repo」**
4. 选择刚才创建的 `splendor-server` 仓库
5. Railway 会自动检测 `package.json` 并部署

### 步骤三：获取服务器地址

1. 部署完成后，点击「Settings」→「Domains」
2. 点击「Generate Domain」
3. 得到地址，如：`splendor-server-xxxx.up.railway.app`

### 步骤四：填入 APK 配置

在游戏 APK 的大厅界面：
- 选择「🌐 跨网联机」
- 创建房间时显示房间码（如 `AB3K`）
- 分享给朋友，朋友输入房间码即可加入

---

## 本地测试

```bash
npm install
npm start
```

访问 `http://localhost:8765` 查看服务器状态。

---

## API 说明

服务器使用 WebSocket 协议，消息格式为 JSON。

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `createRoom` | 客户端→服务器 | 创建房间 |
| `joinRoom` | 客户端→服务器 | 加入房间（需要roomId） |
| `setReady` | 客户端→服务器 | 设置准备状态 |
| `startGame` | 客户端→服务器 | 开始游戏（仅房主） |
| `action` | 客户端→服务器 | 游戏操作 |
| `chat` | 客户端→服务器 | 聊天消息 |
| `roomCreated` | 服务器→客户端 | 房间创建成功，含roomId |
| `joinedRoom` | 服务器→客户端 | 加入房间成功 |
| `roomState` | 服务器→客户端 | 房间状态更新 |
| `gameStarted` | 服务器→客户端 | 游戏开始 |
| `gameAction` | 服务器→客户端 | 广播游戏操作 |
| `error` | 服务器→客户端 | 错误消息 |
