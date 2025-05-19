const WebSocket = require('ws');
const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });

let connections = [];

wss.on('connection', function connection(ws) {
  console.log('🔌 客戶端已連線');

  connections.push(ws);

  ws.on('message', function incoming(message) {
    console.log('📦 收到資料:', message.toString());

    // Broadcast 給所有連線者（前台）
    connections.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('❌ 客戶端離線');
    connections = connections.filter((conn) => conn !== ws);
  });
});

console.log(`✅ WebSocket server is running at ws://localhost:${PORT}`);
