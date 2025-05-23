import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

const ITEMS_PER_PAGE = 6;
const LONG_WAIT_THRESHOLD = 5;
function isValidWsUrl(url) {
  try {
    // 強制補上 ws:// 才驗證
    const fullUrl =
      url.startsWith("ws://") || url.startsWith("wss://") ? url : `ws://${url}`;
    const parsed = new URL(fullUrl);

    // 簡單檢查協議和 port
    if (!["ws:", "wss:"].includes(parsed.protocol)) return false;

    // port 是空字串則為預設port，有填則要在範圍內
    if (parsed.port) {
      const portNum = Number(parsed.port);
      if (isNaN(portNum) || portNum < 0 || portNum > 65535) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [wsUrl, setWsUrl] = useState("192.168.0.47:8080");
  const [hiddenStack, setHiddenStack] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [fadingOutIds, setFadingOutIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("尚未連線");
  const [isLocked, setIsLocked] = useState(true);
  const socketRef = useRef(null);

  const handleConfirm = () => {
    setIsLocked(true);
    // if (socketRef.current) {
    //   socketRef.current.close();
    // }

    // try {
    //   const fullUrl = `ws://${wsUrl}`; // 這裡自動加 ws://
    //   const socket = new WebSocket(fullUrl);
    //   socketRef.current = socket;

    //   socket.onopen = () => setConnectionStatus("已連線");
    //   socket.onclose = () => setConnectionStatus("已中斷");
    //   socket.onerror = () => setConnectionStatus("連線錯誤");
    // } catch (e) {
    //   console.error("WebSocket 建立失敗：", e);
    //   setConnectionStatus("建立連線失敗");
    // }
  };

  const handleEdit = () => {
    setIsLocked(false);
    setConnectionStatus("尚未連線");
    if (socketRef.current) {
      socketRef.current.close();
    }
  };
  // 每分鐘更新等待時間
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((orders) =>
        orders.map((order) => {
          const waitTime = Math.floor((Date.now() - order.createdAt) / 60000);
          return { ...order, waitTime };
        })
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);
  // WebSocket 連線
  useEffect(() => {
    // const socket = new WebSocket("ws://192.168.0.47:8080"); // 確認 WebSocket URL 正確
    if (!isLocked) return;
    if (!isValidWsUrl(wsUrl)) {
      console.error("WebSocket URL 不合法，無法建立連線");
      setConnectionStatus("WebSocket URL 不合法");
      return;
    }
    const fullUrl = `ws://${wsUrl}`;
    const socket = new WebSocket(fullUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      console.log("WebSocket connected");
      setConnectionStatus("已連線");
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      setConnectionStatus("連線錯誤");
    };

    socket.onmessage = (event) => {
      console.log("收到 WebSocket 訊息：", event.data);
      const now = Date.now();
      try {
        const msg = JSON.parse(event.data);
        console.log("解析後的訊息物件：", msg);

        if (msg.type === "order_list_update") {
          const rawOrder = msg.data; // 物件，不是陣列

          // 建立訂單物件
          const formattedOrder = {
            id: `ws_order_${rawOrder.orderNumber}_${now}`,
            no: rawOrder.orderNumber || "未知單號",
            ticketNumber: rawOrder.ticketNumber ?? -1,
            waitTime: 0, // 先預設
            items: rawOrder.items || [],
            createdAt: now,
            isPaid: rawOrder.isPaid ?? false, // 讀取 isPaid 狀態
          };
          setOrders((prevOrders) => {
            const index = prevOrders.findIndex(
              (o) => o.no === formattedOrder.no
            );
            if (index !== -1) {
              const newOrders = [...prevOrders];
              const previousOrder = newOrders[index];

              newOrders[index] = {
                ...formattedOrder,
                createdAt: previousOrder.createdAt, // 保留原始 createdAt
                waitTime: previousOrder.waitTime, // 可留或重算
              };
              return newOrders;
            } else {
              // 新訂單才用 now 作為 createdAt
              return [...prevOrders, { ...formattedOrder, createdAt: now }];
            }
          });
        }
      } catch (e) {
        console.error("解析 WebSocket 訊息錯誤:", e);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      setConnectionStatus("已斷線");
    };

    return () => {
      socket.close();
    };
  }, [isLocked, wsUrl]);

  // 過濾隱藏訂單
  const notHiddenOrders = useMemo(() => {
    const hiddenSet = new Set(hiddenStack);
    return orders.filter((order) => !hiddenSet.has(order.id));
  }, [orders, hiddenStack]);

  // 搜尋功能
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return notHiddenOrders;
    const lowerSearch = searchTerm.trim().toLowerCase();
    return notHiddenOrders.filter((order) => {
      const ticketMatch = order.ticketNumber.toString().includes(lowerSearch);
      const itemsMatch = order.items.some((item) =>
        item.name.toLowerCase().includes(lowerSearch)
      );
      return ticketMatch || itemsMatch;
    });
  }, [searchTerm, notHiddenOrders]);

  // 計算總頁數
  const totalPages = Math.max(
    Math.ceil(filteredOrders.length / ITEMS_PER_PAGE),
    1
  );

  // 當前頁訂單
  const pagedOrders = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleHide = useCallback(
    (id) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return;
      console.log(order);
      // 假設未結帳的訂單有 isPaid === false 或 status !== 'paid'
      if (!order.isPaid) {
        alert("此訂單尚未結帳，無法取消！");
        return;
      }

      // 如果已結帳，才允許隱藏
      setFadingOutIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setHiddenStack((prev) => [...prev, id]);
        setFadingOutIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 400); // 對應 CSS transition
    },
    [orders]
  );

  // 還原最後一筆隱藏訂單
  const handleRestoreOne = useCallback(() => {
    setHiddenStack((prev) => prev.slice(0, prev.length - 1));
  }, []);
  const [showSettings, setShowSettings] = useState(false  ); // 控制收折
  // 還原所有隱藏訂單
  const handleRestoreAll = useCallback(() => {
    setHiddenStack([]);
  }, []);

  // 頁數調整
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  return (
    <>
      <style>{`
          /* 手機響應式排版 */
          .scroll-wrapper {
  max-height: 100vh; /* 或你可以根據需求設為 80vh, 600px 等 */
  overflow-y: auto;
  padding-right: 6px; /* 保留捲軸空間 */
}
          .grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 10px;
            padding: 10px;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .grid-container {
              grid-template-columns: 1fr;
              grid-template-rows: auto;
            }
          }

          /* 卡片樣式 */
          .card {
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            user-select: none;
            box-shadow: 2px 2px 6px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background-color: white;
            transition: opacity 0.4s ease, transform 0.4s ease, background-color 0.3s ease, border-color 0.3s ease;
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
          }
          .card.long-wait {
            background-color: #ffe6e6;
            border-color: #ff4d4d;
          }
          .card.fading-out {
            opacity: 0;
            transform: translateY(-100%);
            pointer-events: none;
          }
            .item-list-scroll {
  margin: 0;
  padding-left: 0;
  flex-grow: 1;
  max-height: 280px;
  overflow-y: auto;
}


        `}</style>

      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          margin: 0,
        }}
      >
        {/* WebSocket 設定與狀態顯示 */}

        {/* 收折控制列 */}

        <div
          style={{
            padding: "6px 10px",
            background: "#eee",
            borderBottom: "1px solid #ccc",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onClick={() => setShowSettings((prev) => !prev)}
        >
          <strong>設定與搜尋</strong>
          <span
                style={{
                  fontWeight: "bold",
                  color: connectionStatus === "已連線" ? "green" : "red",
                  marginLeft: 8,
                }}
              >
                WebSocket 狀態：{connectionStatus}
              </span>
          <span>{showSettings ? "▲ 收起" : "▼ 展開"}</span>
        </div>

        {/* 設定區塊 */}
        {showSettings && (
          <div
            style={{
              padding: 10,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: "1px solid #ddd",
            }}
          >
            {/* WebSocket 設定與狀態 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <label>WebSocket URL：</label>
              <input
                type="text"
                value={wsUrl}
                disabled={isLocked}
                onChange={(e) => setWsUrl(e.target.value)}
                style={{ width: 240 }}
              />
              {isLocked ? (
                <button onClick={handleEdit} title="編輯 URL">
                  ✏️
                </button>
              ) : (
                <button onClick={handleConfirm} title="確認連線">
                  ✅
                </button>
              )}
              <div
                style={{
                  fontWeight: "bold",
                  color: connectionStatus === "已連線" ? "green" : "red",
                  marginLeft: 8,
                }}
              >
                WebSocket 狀態：{connectionStatus}
              </div>
            </div>

            {/* 搜尋與已完成訂單數 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                placeholder="搜尋號碼牌或飲料名稱"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: 15,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  width: 220,
                }}
              />
              <div style={{ fontWeight: "bold", fontSize: 15 }}>
                已完成訂單：{hiddenStack.length} 筆
              </div>
            </div>
          </div>
        )}

        <div className="grid-container" style={{ flex: 1 }}>
          {pagedOrders.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                color: "#999",
                fontSize: 18,
                paddingTop: 40,
              }}
            >
              沒有可顯示的訂單
            </div>
          ) : (
            pagedOrders.map((order) => {
              // ❗ 新增這行：若沒有 items 就跳過渲染
              if (!order.items || order.items.length === 0) return null;
              const isFadingOut = fadingOutIds.has(order.id);
              const isLongWait = order.waitTime > LONG_WAIT_THRESHOLD;
              const classNames = ["card"];
              if (isLongWait) classNames.push("long-wait");
              if (isFadingOut) classNames.push("fading-out");

              return (
                <div
                  key={order.id}
                  onDoubleClick={() => handleHide(order.id)}
                  title="雙擊隱藏訂單"
                  className={classNames.join(" ")}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: 16,
                        color: "#555",
                      }}
                    >
                      單號: {order.no}
                    </div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      號碼牌：{order.ticketNumber}
                    </div>
                    <div style={{ color: "#666" }}>{order.waitTime} 分鐘</div>
                    <div style={{ fontWeight: "bold", fontSize: 16 }}>
                      品數：
                      {order.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )}
                    </div>
                  </div>

                  <div className="item-list-scroll">
                    {order.items.map((item, i) => {
                      const optionsText = item.options?.length
                        ? item.options.map((opt) => opt.name).join("、")
                        : "";
                      const sugar = item.sugar_level || item.sugar || "";
                      const ice = item.ice || "";
                      const eco_cup = item.eco_cup || "";
                      return (
                        <div
                          key={`${item.name}-${i}`}
                          style={{ fontSize: 14, marginBottom: 4 }}
                        >
                          {item.name} x{item.quantity}（ {sugar} / {ice} /{" "}
                          {eco_cup}
                          {optionsText ? ` / ${optionsText}` : ""}）
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* 分頁與還原 */}
        <div
          style={{
            padding: 10,
            borderTop: "1px solid #ddd",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              style={{
                padding: "8px 12px",
                cursor: currentPage === 0 ? "not-allowed" : "pointer",
                marginRight: 8,
              }}
            >
              上一頁
            </button>
            <span style={{ margin: "0 12px" }}>
              第 {currentPage + 1} / {totalPages} 頁
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages - 1))
              }
              disabled={currentPage >= totalPages - 1}
              style={{
                padding: "8px 12px",
                cursor:
                  currentPage >= totalPages - 1 ? "not-allowed" : "pointer",
              }}
            >
              下一頁
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleRestoreOne}
              disabled={hiddenStack.length === 0}
              style={{
                padding: "8px 12px",
                cursor: hiddenStack.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              還原最後一筆
            </button>
            <button
              onClick={handleRestoreAll}
              disabled={hiddenStack.length === 0}
              style={{
                padding: "8px 12px",
                cursor: hiddenStack.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              還原全部
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
