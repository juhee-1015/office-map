"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

// --- 타입 정의 ---
type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }

export default function OfficeMapApp() {
  const [hasMounted, setHasMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");
  const [modalType, setModalType] = useState<"login" | null>(null);
  const [modalInput, setModalInput] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");

  useEffect(() => {
    setHasMounted(true);
    const saved = localStorage.getItem("office-data-v1");
    if (saved) {
      const parsed = JSON.parse(saved);
      setFloors(parsed.floors);
    }
  }, []);

  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem("office-data-v1", JSON.stringify({ floors }));
    }
  }, [floors, hasMounted]);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);

  const updateItems = (newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
  };

  const handleDrag = (id: number, data: { x: number, y: number }) => {
    updateItems(currentFloor.items.map(item => item.id === id ? { ...item, x: data.x, y: data.y } : item));
  };

  const addItem = (type: ItemType) => {
    const newItem: RoomItem = {
      id: Date.now(),
      type,
      name: type === "seat" ? "새 좌석" : "",
      rotation: 0,
      color: type === "seat" ? "#3b82f6" : "#334155",
      width: type === "seat" ? 50 : 100,
      height: type === "seat" ? 50 : 10,
      x: 50, y: 50
    };
    updateItems([...currentFloor.items, newItem]);
  };

  if (!hasMounted) return null;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", backgroundColor: "#f8fafc" }}>
      {/* 사이드바 */}
      <div style={{ width: "260px", background: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "20px" }}>사무실 배치도</h2>
        
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>층 선택</p>
          {floors.map(f => (
            <button key={f.id} onClick={() => setActiveFloorId(f.id)} style={{
              width: "100%", padding: "10px", marginBottom: "5px", borderRadius: "8px", border: "none",
              backgroundColor: activeFloorId === f.id ? "#2563eb" : "#f1f5f9",
              color: activeFloorId === f.id ? "#fff" : "#64748b", cursor: "pointer"
            }}>{f.displayName}</button>
          ))}
        </div>

        <div style={{ marginTop: "auto" }}>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={{
            width: "100%", padding: "12px", borderRadius: "10px", border: "none",
            backgroundColor: isAdmin ? "#ef4444" : "#1e293b", color: "#fff", cursor: "pointer", fontWeight: "bold"
          }}>{isAdmin ? "편집 모드 종료" : "관리자 로그인"}</button>
          
          {isAdmin && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
              <button onClick={() => addItem("seat")} style={actionBtnS}>좌석 추가</button>
              <button onClick={() => addItem("wall")} style={actionBtnS}>벽체 추가</button>
            </div>
          )}
        </div>
      </div>

      {/* 도면 영역 */}
      <div style={{ flex: 1, padding: "30px", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: "20px", border: "1px dashed #cbd5e1", position: "relative" }}>
          {currentFloor.items.map(item => (
            <Draggable key={item.id} position={{ x: item.x, y: item.y }} onDrag={(e, data) => handleDrag(item.id, data)} disabled={!isAdmin}>
              <div style={{
                position: "absolute", width: item.width, height: item.height, backgroundColor: item.color,
                display: "flex", alignItems: "center", justifyContent: "center", borderRadius: item.type === "seat" ? "8px" : "2px",
                color: "#fff", fontSize: "11px", fontWeight: "bold", cursor: isAdmin ? "move" : "default",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transform: `rotate(${item.rotation}deg)`
              }}>
                {item.name}
              </div>
            </Draggable>
          ))}
        </div>
      </div>

      {/* 로그인 모달 */}
      {modalType === "login" && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "15px" }}>관리자 비밀번호</h3>
            <input type="password" value={modalInput} onChange={e => setModalInput(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ddd", borderRadius: "5px" }} />
            <div style={{ display: "flex", gap: "5px" }}>
              <button onClick={() => setModalType(null)} style={{ flex: 1, padding: "10px", background: "#f1f5f9", border: "none", borderRadius: "5px" }}>취소</button>
              <button onClick={() => { if(modalInput === adminPassword) { setIsAdmin(true); setModalType(null); } else alert("비밀번호가 틀렸습니다."); setModalInput(""); }} style={{ flex: 1, padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "5px" }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtnS = { padding: "10px", backgroundColor: "#eff6ff", color: "#2563eb", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" as const };
const modalOverlayS = { position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContentS = { backgroundColor: "#fff", padding: "20px", borderRadius: "15px", width: "300px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
