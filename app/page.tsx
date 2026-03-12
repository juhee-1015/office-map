"use client";

import React, { useState, useEffect } from "react";
import Draggable from "react-draggable";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{ padding: "20px" }}>로딩 중...</div>;

  return (
    <div style={{ padding: "40px", backgroundColor: "#f0f2f5", height: "100vh" }}>
      <h1 style={{ color: "#1a1a1a" }}>우리 회사 배치도 테스트</h1>
      <p>좌석을 마우스로 드래그해 보세요!</p>
      
      <div style={{ width: "100%", height: "500px", background: "white", border: "2px dashed #ccc", position: "relative" }}>
        <Draggable defaultPosition={{x: 50, y: 50}}>
          <div style={{ 
            width: "80px", height: "80px", backgroundColor: "#3b82f6", 
            color: "white", display: "flex", alignItems: "center", 
            justifyContent: "center", borderRadius: "10px", cursor: "move" 
          }}>
            좌석 1
          </div>
        </Draggable>

        <Draggable defaultPosition={{x: 150, y: 50}}>
          <div style={{ 
            width: "80px", height: "80px", backgroundColor: "#ef4444", 
            color: "white", display: "flex", alignItems: "center", 
            justifyContent: "center", borderRadius: "10px", cursor: "move" 
          }}>
            좌석 2
          </div>
        </Draggable>
      </div>
    </div>
  );
}
