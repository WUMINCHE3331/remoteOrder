let socket;

export function initWebSocket(onMessage) {
  socket = new WebSocket('ws://localhost:8080');

  socket.onopen = () => console.log('✅ WebSocket 已連線');
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  socket.onerror = (err) => console.error('❌ WebSocket 錯誤:', err);
}

export function sendOrderUpdate(orderItem) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(orderItem));
  }
}
