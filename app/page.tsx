"use client";
import React, { useState, useEffect } from "react";
import Draggable from "react-draggable";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div style={{ padding: "40px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: "20px" }}>사무실 배치도 업데이트 완료!</h1>
      <div style={{ width: "100%", height: "600px", background: "white", border: "2px dashed #cbd5e1", position: "relative", borderRadius: "15px" }}>
        <Draggable defaultPosition={{x: 50, y: 50}}>
          <div style={{ width: "100px", height: "100px", backgroundColor: "#3b82f6", color: "white", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "move", fontWeight: "bold", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
            좌석 A
          </div>
        </Draggable>
      </div>
    </div>
  );
}
