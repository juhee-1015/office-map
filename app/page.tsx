"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }
// 버전 관리를 위한 인터페이스
interface SavedVersion { id: string; name: string; date: string; data: FloorInfo[]; }

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");

  const [modalType, setModalType] = useState<"login" | "changePw" | "alert" | "confirm" | "saveVersion" | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMsg, setModalMsg] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  
  // 저장된 버전 리스트
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);

  // 1. 데이터 계산부 (에러 방지를 위해 위쪽으로 이동)
  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;

  const stats = useMemo(() => {
    const seats = currentItems.filter(i => i.type === "seat");
    const teams = seats.reduce((acc: any, cur) => {
      acc[cur.color] = (acc[cur.color] || 0) + 1;
      return acc;
    }, {});
    return { total: seats.length, teams };
  }, [currentItems]);

  const updateItems = (newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
  };

  // 2. 삭제 및 버전 관리 로직
  const requestDelete = () => {
    if (selectedIds.length === 0) return;
    setModalMsg(`선택한 ${selectedIds.length}개 항목을 삭제하시겠습니까?`);
    setModalType("confirm");
  };

  const saveCurrentVersion = () => {
    if (!modalInput.trim()) return;
    const newVersion: SavedVersion = {
      id: `V-${Date.now()}`,
      name: modalInput,
      date: new Date().toLocaleDateString(),
      data: JSON.parse(JSON.stringify(floors)) // 깊은 복사
    };
    setSavedVersions([newVersion, ...savedVersions]);
    setModalType("alert");
    setModalMsg("배치도가 저장되었습니다.");
    setModalInput("");
  };

  const loadVersion = (version: SavedVersion) => {
    if (confirm(`'${version.name}' 버전으로 교체하시겠습니까? 현재 작업 중인 내용은 사라집니다.`)) {
      setFloors(version.data);
      setActiveFloorId(version.data[0].id);
      setSelectedIds([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAdmin || selectedIds.length === 0 || modalType !== null) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Delete" || e.key === "Backspace") requestDelete();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, selectedIds, modalType, currentItems]);

  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); setModalInput(""); }
      else { setModalMsg("비밀번호가 틀렸습니다."); setModalType("alert"); setModalInput(""); }
    } else if (modalType === "changePw") {
      if (modalInput.trim()) { setAdminPassword(modalInput); setModalMsg("비밀번호가 변경되었습니다."); setModalType("alert"); setModalInput(""); }
    } else if (modalType === "saveVersion") {
      saveCurrentVersion();
    } else if (modalType === "confirm") {
      updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
      setSelectedIds([]);
      setModalType(null);
    } else {
      setModalType(null);
    }
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!isAdmin || e.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelectedIds([]);
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "bold" }}>
              {modalType === "saveVersion" ? "현재 배치 저장" : "알림"}
            </h3>
            <div style={{ padding: "0 25px" }}>
              {(modalType === "login" || modalType === "changePw" || modalType === "saveVersion") && (
                <input 
                  value={modalInput} 
                  onChange={(e) => setModalInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} 
                  style={modalInputS} 
                  placeholder={modalType === "saveVersion" ? "예: 2026년 3월 배치" : "비밀번호"}
                  autoFocus 
                />
              )}
              {(modalType === "alert" || modalType === "confirm") && <p style={{ fontSize: "14px", color: "#475569" }}>{modalMsg}</p>}
              <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
                <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={sidebarS}>
        <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "15px" }}>{appTitle}</h2>
        
        {/* 통계 섹션 */}
        <div style={statsCardS}>
          <div style={{ fontWeight: "800", fontSize: "17px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", marginBottom: "10px" }}>총 {stats.total}석</div>
          {Object.entries(stats.teams).map(([color, count]: any) => (
            <div key={color} style={groupRowS}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px" }} />
                <span>{teamNames[color] || "미지정"}</span>
              </div>
              <span style={{ fontWeight: "bold" }}>{count}석</span>
            </div>
          ))}
        </div>

        {/* 버전 관리 섹션 (추가됨) */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelS}>히스토리 (저장된 버전)</label>
          <div style={versionListS}>
            {savedVersions.length === 0 ? (
              <p style={{fontSize: "11px", color: "#94a3b8", textAlign: "center", padding: "10px"}}>저장된 기록이 없습니다.</p>
            ) : (
              savedVersions.map(v => (
                <div key={v.id} onClick={() => loadVersion(v)} style={versionItemS}>
                  <div style={{fontWeight: "bold"}}>{v.name}</div>
                  <div style={{fontSize: "10px", color: "#94a3b8"}}>{v.date}</div>
                </div>
              ))
            )}
          </div>
          {isAdmin && <button onClick={() => setModalType("saveVersion")} style={saveVerBtnS}>현재 배치 저장하기</button>}
        </div>

        {/* 하단 관리 버튼 */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
          {isAdmin && (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"seat", name:"좌석", rotation:0, color:"#3b82f6", width:45, height:45, x:50, y:50}]); }} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        <div ref={canvasRef} style={canvasS} onMouseDown={onCanvasMouseDown}>
          {currentItems.map((item) => (
            <DraggableComponent key={item.id} item={item} isSelected={selectedIds.includes(item.id)} isAdmin={isAdmin} onSelect={() => setSelectedIds([item.id])} onDrag={(data:any) => {
              const target = currentItems.find(i => i.id === item.id);
              if (target) updateItems(currentItems.map(i => i.id === item.id ? { ...i, x: data.x, y: data.y } : i));
            }} />
          ))}
        </div>
      </div>
    </main>
  );
}

// Draggable 및 스타일 (생략된 스타일은 이전과 동일하되 pb 에러 등 수정됨)
function DraggableComponent({ item, isSelected, isAdmin, onSelect, onDrag }: any) {
  const nodeRef = useRef(null);
  return (
    <Draggable nodeRef={nodeRef} position={{ x: item.x, y: item.y }} onStart={onSelect} onDrag={(e, data) => onDrag(data)} disabled={!isAdmin}>
      <div ref={nodeRef} style={{ position: "absolute", zIndex: isSelected ? 100 : 10 }}>
        <div style={{ width: item.width, height: item.height, backgroundColor: item.color, border: isSelected ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.1)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "10px", color: "#fff", fontWeight: "bold" }}>{item.name}</span>
        </div>
      </div>
    </Draggable>
  );
}

const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "sans-serif" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" };
const canvasS: any = { width: "100%", height: "100%", backgroundColor: "#fff", borderRadius: "15px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "30px 0", borderRadius: "20px", width: "320px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalInputS: any = { width: "80%", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer", width: "100%" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" });
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "15px" };
const groupRowS: any = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12px" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "8px", display: "block" };
const versionListS: any = { maxHeight: "120px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "8px", padding: "5px" };
const versionItemS: any = { padding: "8px", borderBottom: "1px solid #f8fafc", cursor: "pointer", fontSize: "12px" };
const saveVerBtnS: any = { width: "100%", padding: "8px", marginTop: "10px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", color: "#64748b", fontSize: "11px", cursor: "pointer", fontWeight: "bold" };
