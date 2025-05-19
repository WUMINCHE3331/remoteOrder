import React, { useState, useEffect, useMemo, useCallback } from "react";

// 加了 no 欄位的資料範例
const baseOrders = [
  { no: 1, id: "a1", ticketNumber: 101, waitTime: 3, items: [{ name: "紅茶", quantity: 1, ice: "正常冰", sugar: "半糖" }] },
  { no: 2, id: "a2", ticketNumber: 102, waitTime: 2, items: [{ name: "珍奶", quantity: 2, ice: "少冰", sugar: "無糖" }] },
  { no: 3, id: "a3", ticketNumber: 103, waitTime: 1, items: [{ name: "抹茶拿鐵", quantity: 1, ice: "微冰", sugar: "微糖" }] },
  { no: 4, id: "a4", ticketNumber: 104, waitTime: 4, items: [{ name: "烏龍綠", quantity: 1, ice: "正常冰", sugar: "無糖" }] },
  { no: 5, id: "a5", ticketNumber: 105, waitTime: 6, items: [{ name: "多多綠", quantity: 2, ice: "去冰", sugar: "微糖" }] },
  { no: 6, id: "a6", ticketNumber: 106, waitTime: 5, items: [{ name: "可可牛奶", quantity: 1, ice: "少冰", sugar: "正常" }] },
  { no: 7, id: "a7", ticketNumber: 107, waitTime: 7, items: [{ name: "青茶", quantity: 1, ice: "微冰", sugar: "無糖" }] },
];

// 產生多筆資料（保留 no，no + i）
function generateMockOrders(count = 50) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const base = baseOrders[i % baseOrders.length];
    result.push({
      ...base,
      id: `order_${i + 1}`,
      no: base.no + i,
      ticketNumber: base.ticketNumber + i,
      waitTime: base.waitTime + (i % 5),
    });
  }
  return result;
}

const mockOrders = generateMockOrders(50);

const ITEMS_PER_PAGE = 6;
const LONG_WAIT_THRESHOLD = 5;

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [hiddenStack, setHiddenStack] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [fadingOutIds, setFadingOutIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setOrders(mockOrders);
  }, []);

  const notHiddenOrders = useMemo(() => {
    const hiddenSet = new Set(hiddenStack);
    return orders.filter((order) => !hiddenSet.has(order.id));
  }, [orders, hiddenStack]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return notHiddenOrders;
    const lowerSearch = searchTerm.trim().toLowerCase();
    return notHiddenOrders.filter((order) => {
      const ticketMatch = order.ticketNumber.toString().includes(lowerSearch);
      const itemsMatch = order.items.some((item) => item.name.toLowerCase().includes(lowerSearch));
      return ticketMatch || itemsMatch;
    });
  }, [searchTerm, notHiddenOrders]);

  const totalPages = Math.max(Math.ceil(filteredOrders.length / ITEMS_PER_PAGE), 1);

  const pagedOrders = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleHide = useCallback((id) => {
    setFadingOutIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setHiddenStack((prev) => [...prev, id]);
      setFadingOutIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 400); // 配合CSS transition時間
  }, []);

  const handleRestoreOne = useCallback(() => {
    setHiddenStack((prev) => prev.slice(0, prev.length - 1));
  }, []);

  const handleRestoreAll = useCallback(() => {
    setHiddenStack([]);
  }, []);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  return (
    <>
      <style>{`
        /* 手機響應式排版 */
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
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: 0, margin: 0 }}>
        {/* 搜尋與已完成訂單數 */}
        <div
          style={{
            padding: 10,
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            gap: 20,
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
              padding: "8px 12px",
              fontSize: 16,
              flexGrow: 1,
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          />
          <div style={{ fontWeight: "bold", fontSize: 16 }}>已完成訂單：{hiddenStack.length} 筆</div>
        </div>

        {/* 訂單卡片區 */}
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
                  <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 4, color: "#555" }}>
                    序號：{order.no}
                  </div>
                  <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 6 }}>
                    號碼牌：{order.ticketNumber}
                  </div>
                  <div style={{ color: "#666", marginBottom: 8 }}>等待時間：{order.waitTime} 分鐘</div>
                  <ul style={{ margin: 0, paddingLeft: 20, flexGrow: 1 }}>
                    {order.items.map((item, i) => (
                      <li key={`${item.name}-${i}`} style={{ fontSize: 14 }}>
                        {item.name} x{item.quantity} （{item.ice} / {item.sugar}）
                      </li>
                    ))}
                  </ul>
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
              style={{ padding: "8px 12px", cursor: currentPage === 0 ? "not-allowed" : "pointer", marginRight: 8 }}
            >
              上一頁
            </button>
            <span style={{ margin: "0 12px" }}>
              第 {currentPage + 1} 頁 / 共 {totalPages} 頁
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage + 1 >= totalPages}
              style={{ padding: "8px 12px", cursor: currentPage + 1 >= totalPages ? "not-allowed" : "pointer" }}
            >
              下一頁
            </button>
          </div>

          <div>
            <button
              onClick={handleRestoreOne}
              disabled={hiddenStack.length === 0}
              style={{
                padding: "10px 20px",
                marginRight: 10,
                backgroundColor: hiddenStack.length === 0 ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: hiddenStack.length === 0 ? "not-allowed" : "pointer",
              }}
              title="還原最後隱藏的訂單"
            >
              還原一筆
            </button>

            <button
              onClick={handleRestoreAll}
              disabled={hiddenStack.length === 0}
              style={{
                padding: "10px 20px",
                backgroundColor: hiddenStack.length === 0 ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: hiddenStack.length === 0 ? "not-allowed" : "pointer",
              }}
              title="還原所有隱藏訂單"
            >
              還原全部
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
