"use client";
import React, { useState, useEffect } from "react";
import Draggable from "react-draggable";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div style={{ padding: "50px" }}>
      <h1>배치도 테스트</h1>
      <Draggable>
        <div style={{ width: "100px", height: "100px", bgcolor: "blue", color: "white", cursor: "move", display: "flex", alignItems: "center", justifyContent: "center", background: "blue" }}>
          드래그 가능
        </div>
      </Draggable>
    </div>
  );
}
