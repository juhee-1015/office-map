"use client";

import React, { useState, useEffect } from "react";
import Draggable from "react-draggable";

export default function OfficeMapApp() {
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  // 페이지 로드 시 저장된 데이터 불러오기
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("office-data-final");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("데이터 로드 실패", e);
      }
    }
  }, []);

  // 데이터 변경 시 로컬 저장소에 자동 저장
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("office-data-final", JSON.stringify(items));
    }
  }, [items, mounted]);

  // 새로운 좌석 추가 함수
  const addItem = () => {
    const newItem = {
      id: Date.now(),
      name: `좌석 ${items.length + 1}`,
      x: 50,
      y: 50,
      color: "#3b82f6"
    };
    setItems([...items, newItem]);
  };

  // 좌석 삭제 함수
  const deleteItem = (id: number) => {
    if (confirm("이 좌석을 삭제할까요?")) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "sans-serif" }}>
      {/* 왼쪽 관리 도구 모음 */}
      <div style={{ width: "260px", padding: "20px", background: "#fff", borderRight: "1px solid #e2e8f0", boxShadow: "2px 0 5px rgba(0,0,0,0.05)" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "20px", color: "#1e293b" }}>사무실 배치도</h2>
        
        <button 
          onClick={() => setIsAdmin(!isAdmin)} 
          style={{ 
            width: "100%", padding: "12px", marginBottom: "15px", 
            backgroundColor: isAdmin ? "#ef4444" : "#2563eb", 
            color: "#fff", border: "none", borderRadius: "10px", 
            cursor: "pointer", fontWeight: "bold", transition: "0.3s"
          }}
        >
          {isAdmin ? "🛠 편집 종료" : "⚙️ 편집 모드 시작"}
        </button>

        {isAdmin && (
          <div style={{ padding: "15px", backgroundColor: "#f1f5f9", borderRadius: "10px" }}>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "10px" }}>관리자 메뉴</p>
            <button 
              onClick={addItem} 
              style={{ 
                width: "100%", padding: "10px", backgroundColor: "#fff", 
                border: "1px solid #cbd5e1", borderRadius: "8px", 
                cursor: "pointer", fontWeight: "600", color: "#334155" 
              }}
            >
              + 새 좌석 추가
            </button>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "10px" }}>
              * 좌석을 드래그해서 배치하세요.
            </p>
          </div>
        )}
      </div>

      {/* 오른쪽 실제 도면 영역 */}
      <div style={{ flex: 1, padding: "40px", position: "relative", overflow: "hidden" }}>
        <div style={{ 
          width: "100%", height: "100%", background: "#fff", 
          borderRadius: "20px", border: "2px dashed #cbd5e1", 
          position: "relative", overflow: "auto",
          backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}>
          {items.map((item) => (
            <Draggable
              key={item.id}
              position={{ x: item.x, y: item.y }}
              onDrag={(e, data) => {
                setItems(items.map(i => i.id === item.id ? { ...i, x: data.x, y: data.y } : i));
              }}
              disabled={!isAdmin}
            >
              <div 
                style={{ 
                  position: "absolute", width: "60px", height: "60px", 
                  backgroundColor: item.color, color: "#fff", 
                  borderRadius: "12px", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", 
                  fontSize: "12px", fontWeight: "bold",
                  cursor: isAdmin ? "move" : "default", 
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  userSelect: "none"
                }}
                onDoubleClick={() => isAdmin && deleteItem(item.id)}
              >
                {item.name}
              </div>
            </Draggable>
          ))}

          {items.length === 0 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#94a3b8" }}>
              편집 모드를 켜고 좌석을 추가해 주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
