const WebSocket = require('ws');
const PORT = 8080;

const wss = new WebSocket.Server({ host: '0.0.0.0', port: PORT });

let connections = [];

wss.on('connection', function connection(ws) {
  console.log('🔌 客戶端已連線');

  connections.push(ws);

  ws.on('message', function incoming(message) {
    console.log('📦 收到資料:', message.toString());
    //   const msg = message.toString(); // 👈 確保是字串格式
    // // ✅ 若收到 ping 就回傳 pong
    // if (msg === 'ping') {
    //   ws.send('pong');
    //   return;
    // }

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

console.log(`✅ WebSocket server is running at ws://0.0.0.0:${PORT}`);    
