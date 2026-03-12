"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

// --- 타입 정의 ---
type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; textColor: string; opacity: number; textOpacity: number;
  width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }
interface SavedVersion { id: string; name: string; date: string; data: FloorInfo[]; }

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [history, setHistory] = useState<FloorInfo[][]>([]);
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6"]);

  const [modalType, setModalType] = useState<"login" | "changePw" | "saveVersion" | "restoreConfirm" | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [pendingRestore, setPendingRestore] = useState<FloorInfo[] | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => { setHasMounted(true); }, []);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItems = useMemo(() => currentItems.filter(i => selectedIds.includes(i.id)), [currentItems, selectedIds]);
  const firstSelected = selectedItems[0];

  const saveHistory = () => setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(floors))]);
  const undo = () => { 
    if (history.length === 0) return; 
    setFloors(history[history.length - 1]); 
    setHistory(prev => prev.slice(0, -1)); 
  };

  const updateItems = (newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
  };

  // ✅ [복구] 아이템 추가 함수 (에러 해결 핵심!)
  const addItem = (type: ItemType) => {
    saveHistory();
    const id = Date.now();
    const newItem: RoomItem = {
      id, type,
      name: type === "seat" ? "새 좌석" : type === "wall" ? "" : "출입문",
      rotation: 0,
      color: type === "seat" ? "#3b82f6" : type === "wall" ? "#333" : "#10b981",
      textColor: "#fff", opacity: 1, textOpacity: 1,
      width: type === "wall" ? 150 : 45,
      height: type === "wall" ? 10 : 45,
      x: 100, y: 100
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
  };

  // ✅ [복구] 정렬 및 회전 함수
  const alignObjects = (direction: 'horizontal' | 'vertical') => {
    if (selectedItems.length < 2) return;
    saveHistory();
    if (direction === 'horizontal') {
      const avgY = selectedItems.reduce((acc, cur) => acc + cur.y, 0) / selectedItems.length;
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, y: avgY } : i));
    } else {
      const avgX = selectedItems.reduce((acc, cur) => acc + cur.x, 0) / selectedItems.length;
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: avgX } : i));
    }
  };

  const rotateObjects = (deg: number) => {
    if (selectedIds.length === 0) return;
    saveHistory();
    updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: (i.rotation + deg) % 360 } : i));
  };

  const duplicateSelected = () => {
    if (selectedIds.length === 0) return;
    saveHistory();
    const newItems = [...currentItems];
    const newSelectedIds: number[] = [];
    selectedItems.forEach(item => {
      const newId = Date.now() + Math.random();
      newItems.push({ ...item, id: newId, x: item.x + 20, y: item.y + 20 });
      newSelectedIds.push(newId);
    });
    updateItems(newItems);
    setSelectedIds(newSelectedIds);
  };

  const handleModalConfirm = () => {
    if (modalType === "login" && modalInput === adminPassword) setIsAdmin(true);
    else if (modalType === "changePw") setAdminPassword(modalInput);
    else if (modalType === "saveVersion") {
      setSavedVersions([{ id: `V-${Date.now()}`, name: modalInput || "새 버전", date: new Date().toLocaleString(), data: JSON.parse(JSON.stringify(floors)) }, ...savedVersions]);
    } else if (modalType === "restoreConfirm" && pendingRestore) {
      saveHistory();
      setFloors(pendingRestore);
    }
    setModalType(null); setModalInput(""); setPendingRestore(null);
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {/* 모달 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{marginBottom: "15px", fontWeight: "bold"}}>{modalType === "login" ? "관리자 로그인" : modalType === "restoreConfirm" ? "복구하시겠습니까?" : "설정"}</h3>
            {modalType === "restoreConfirm" ? <p style={{fontSize: "13px", marginBottom: "20px"}}>이전 상태로 되돌립니다.</p> : <input type="password" value={modalInput} onChange={(e) => setModalInput(e.target.value)} style={modalInputS} autoFocus />}
            <div style={{display: "flex", gap: "10px", justifyContent: "center", marginTop: "10px"}}>
              <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
              <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 왼쪽 사이드바 */}
      <div style={sidebarS}>
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{fontWeight: "bold", fontSize: "16px", marginBottom: "20px"}}>{appTitle}</h2>}
        
        {/* 층 목록 */}
        <div style={{marginBottom: "15px"}}>
          <label style={labelS}>층 이동</label>
          {floors.map((f) => (
            <button key={f.id} onClick={() => setActiveFloorId(f.id)} style={{...floorBtnS(activeFloorId === f.id), width: "100%", marginBottom: "4px"}}>{f.displayName}</button>
          ))}
        </div>

        {/* 관리자 도구 */}
        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <>
              <button onClick={() => addItem("seat")} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <button onClick={() => addItem("wall")} style={actionBtnS("#f8fafc", "#333")}>벽체 추가</button>
              <button onClick={() => addItem("door")} style={actionBtnS("#ecfdf5", "#10b981")}>문 추가</button>
            </>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 캔버스 */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        {isAdmin && <button onClick={undo} style={floatingUndoBtnS}>↩ 되돌리기</button>}
        <div ref={canvasRef} style={canvasS} onMouseDown={(e) => { if (!isAdmin || e.target !== canvasRef.current) return; setSelectedIds([]); }}>
          {currentItems.map((item) => (
            <Draggable key={item.id} position={{ x: item.x, y: item.y }} onStart={() => setSelectedIds([item.id])}
              onDrag={(e, data) => { updateItems(currentItems.map(i => i.id === item.id ? { ...i, x: data.x, y: data.y } : i)); }} onStop={saveHistory} disabled={!isAdmin}>
              <div style={{ position: "absolute", zIndex: selectedIds.includes(item.id) ? 100 : 10 }}>
                <div style={{ transform: `rotate(${item.rotation}deg)`, width: item.width, height: item.height, backgroundColor: item.color, border: selectedIds.includes(item.id) ? "2px solid #2563eb" : "1px solid #ddd", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: item.textColor, fontSize: "11px", fontWeight: "bold" }}>{item.name}</div>
              </div>
            </Draggable>
          ))}
        </div>
      </div>

      {/* 우측 설정 패널 */}
      {isAdmin && firstSelected && (
        <div style={rightPanelS}>
          <div style={propCardS}><label style={labelS}>이름 / 크기</label>
            <input value={firstSelected.name} onChange={(e) => updateItems(currentItems.map(i => i.id === firstSelected.id ? {...i, name: e.target.value} : i))} style={inputS} />
            <div style={{display: "flex", gap: "4px", marginTop: "5px"}}><input type="number" value={firstSelected.width} onChange={(e) => updateItems(currentItems.map(i => i.id === firstSelected.id ? {...i, width: +e.target.value} : i))} style={inputS} /><input type="number" value={firstSelected.height} onChange={(e) => updateItems(currentItems.map(i => i.id === firstSelected.id ? {...i, height: +e.target.value} : i))} style={inputS} /></div>
          </div>

          <div style={propCardS}><label style={labelS}>편집 도구</label>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px"}}>
              <button onClick={() => alignObjects('horizontal')} style={utilBtnS}>가로 정렬</button>
              <button onClick={() => alignObjects('vertical')} style={utilBtnS}>세로 정렬</button>
              <button onClick={() => rotateObjects(90)} style={utilBtnS}>90° 회전</button>
              <button onClick={() => rotateObjects(45)} style={utilBtnS}>45° 회전</button>
            </div>
            <button onClick={duplicateSelected} style={{...utilBtnS, width: "100%", backgroundColor: "#f0fdf4", fontWeight: "bold", marginBottom: "5px"}}>선택 복제</button>
            <button onClick={() => { updateItems(currentItems.filter(i => i.id !== firstSelected.id)); setSelectedIds([]); }} style={{...utilBtnS, width: "100%", backgroundColor: "#fef2f2", color: "#ef4444"}}>삭제</button>
          </div>
        </div>
      )}
    </main>
  );
}

// 스타일 객체 (이전과 동일)
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f1f5f9" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", padding: "15px", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "230px", backgroundColor: "#fff", padding: "15px", borderLeft: "1px solid #e2e8f0", overflowY: "auto" };
const canvasS: any = { flex: 1, height: "100%", borderRadius: "12px", border: "1px solid #e2e8f0", position: "relative", backgroundColor: "#fff" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "20px", borderRadius: "12px", width: "300px", textAlign: "center" };
const modalInputS: any = { width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "8px" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "12px" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "12px", marginBottom: "5px" });
const floorBtnS: any = (act: boolean) => ({ padding: "8px", backgroundColor: act ? "#2563eb" : "#f8fafc", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer" });
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", marginBottom: "8px" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "5px" };
const inputS: any = { width: "100%", padding: "5px", border: "1px solid #eee", borderRadius: "4px", fontSize: "12px" };
const utilBtnS: any = { padding: "8px", border: "1px solid #eee", borderRadius: "6px", fontSize: "11px", cursor: "pointer", backgroundColor: "#fff" };
const titleEditS: any = { fontSize: "15px", fontWeight: "bold", border: "2px solid #2563eb", borderRadius: "8px", width: "100%", marginBottom: "15px", padding: "8px" };
const floatingUndoBtnS: any = { position: "absolute", top: "20px", right: "20px", zIndex: 100, padding: "8px 15px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "20px", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" };
