"use client";

import React, { useState, useEffect } from "react";
import Draggable from "react-draggable";

export default function OfficeMap() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState([
    { id: 1, name: "사장님", x: 100, y: 100, color: "#ef4444" },
    { id: 2, name: "나", x: 200, y: 100, color: "#3b82f6" },
  ]);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div style={{ padding: "20px", background: "#f8fafc", height: "100vh" }}>
      <h2>사무실 배치도 (드래그 가능)</h2>
      <div style={{ width: "100%", height: "80vh", background: "#fff", border: "1px solid #ddd", position: "relative" }}>
        {items.map((item) => (
          <Draggable key={item.id} defaultPosition={{ x: item.x, y: item.y }}>
            <div style={{
              width: "60px", height: "60px", backgroundColor: item.color, color: "#fff",
              borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "move", position: "absolute", fontWeight: "bold"
            }}>
              {item.name}
            </div>
          </Draggable>
        ))}
      </div>
    </div>
  );
}
