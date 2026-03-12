"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

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
  const [canvasBg, setCanvasBg] = useState("#ffffff");

  const [modalType, setModalType] = useState<"login" | "changePw" | "saveVersion" | null>(null);
  const [modalInput, setModalInput] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6"]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const [draggedFloorIdx, setDraggedFloorIdx] = useState<number | null>(null);

  useEffect(() => { 
    setHasMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && isAdmin && selectedIds.length > 0) {
        if(e.target instanceof HTMLInputElement) return;
        updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, selectedIds, floors, activeFloorId]);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItems = useMemo(() => currentItems.filter(i => selectedIds.includes(i.id)), [currentItems, selectedIds]);
  const firstSelected = selectedItems[0];

  const updateItems = (newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
  };

  const addItem = (type: ItemType) => {
    const id = Date.now();
    const newItem: RoomItem = {
      id, type, name: type === "seat" ? "새 좌석" : "", rotation: 0,
      color: type === "seat" ? "#3b82f6" : "#333333",
      textColor: "#ffffff", opacity: 1, textOpacity: 1, width: type === "wall" ? 120 : 45, height: type === "wall" ? 8 : 45, x: 150, y: 150
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
  };

  // 1. 층 이름 변경 및 드래그 순서 변경
  const handleFloorSort = (dragIdx: number, hoverIdx: number) => {
    const newFloors = [...floors];
    const draggedItem = newFloors[dragIdx];
    newFloors.splice(dragIdx, 1);
    newFloors.splice(hoverIdx, 0, draggedItem);
    setFloors(newFloors);
  };

  const copySelected = () => {
    const newItems = [...currentItems];
    const newIds: number[] = [];
    selectedItems.forEach(item => {
      const id = Date.now() + Math.random();
      newItems.push({ ...item, id, x: item.x + 20, y: item.y + 20 });
      newIds.push(id);
    });
    updateItems(newItems);
    setSelectedIds(newIds);
  };

  const handleModalConfirm = () => {
    if (modalType === "login" && modalInput === adminPassword) setIsAdmin(true);
    else if (modalType === "changePw") setAdminPassword(modalInput);
    else if (modalType === "saveVersion") {
      setSavedVersions([{ id: `V-${Date.now()}`, name: modalInput || "새 버전", date: new Date().toLocaleString(), data: JSON.parse(JSON.stringify(floors)) }, ...savedVersions]);
    }
    setModalType(null); setModalInput("");
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{marginBottom: "15px"}}>{modalType === "changePw" ? "관리자 비밀번호 변경" : "입력"}</h3>
            <input type={(modalType === "login" || modalType === "changePw") ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} style={modalInputS} autoFocus />
            <div style={{display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px"}}>
              <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
              <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 사이드바 */}
      <div style={sidebarS}>
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{fontWeight: "bold", fontSize: "16px", marginBottom: "20px"}}>{appTitle}</h2>}
        
        <div style={{marginBottom: "20px"}}>
          <label style={labelS}>층 관리 (드래그로 순서 변경)</label>
          <div style={{display: "flex", flexDirection: "column", gap: "4px"}}>
            {floors.map((f, idx) => (
              <div key={f.id} draggable={isAdmin} 
                onDragStart={() => setDraggedFloorIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); if(draggedFloorIdx !== null && draggedFloorIdx !== idx) { handleFloorSort(draggedFloorIdx, idx); setDraggedFloorIdx(idx); }}}
                style={{display: "flex", gap: "4px", alignItems: "center", cursor: isAdmin ? "grab" : "default"}}>
                {isAdmin ? (
                  <input value={f.displayName} onChange={(e) => setFloors(floors.map(it => it.id === f.id ? {...it, displayName: e.target.value} : it))} style={{...floorBtnS(activeFloorId === f.id), flex: 1, border: "1px solid #e2e8f0"}} />
                ) : (
                  <button onClick={() => setActiveFloorId(f.id)} style={{...floorBtnS(activeFloorId === f.id), flex: 1}}>{f.displayName}</button>
                )}
                {isAdmin && <button onClick={() => { if(floors.length > 1) setFloors(floors.filter(it => it.id !== f.id)); }} style={floorDelBtnS}>×</button>}
              </div>
            ))}
            {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: "새 층", items: [] }])} style={addFloorBtnS}>+ 층 추가</button>}
          </div>
        </div>

        {isAdmin && (
          <div style={historyBoxS}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px"}}>
              <span style={{fontWeight: "bold"}}>히스토리</span>
              <button onClick={() => setModalType("saveVersion")} style={{fontSize: "10px", padding: "2px 5px"}}>저장</button>
            </div>
            {savedVersions.map(v => (
              <div key={v.id} style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0"}}>
                <span onClick={() => confirm("복구할까요?") && setFloors(v.data)} style={{cursor: "pointer"}}>{v.name}</span>
                <button onClick={() => setSavedVersions(savedVersions.filter(it => it.id !== v.id))} style={miniDelBtnS}>삭제</button>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <div style={{display: "grid", gridTemplateColumns: "1fr", gap: "5px"}}>
              <button onClick={() => addItem("seat")} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <div style={{display: "flex", gap: "5px"}}>
                <button onClick={() => addItem("wall")} style={{...actionBtnS("#f8fafc", "#333"), flex: 1}}>벽체</button>
                <button onClick={() => addItem("door")} style={{...actionBtnS("#ecfdf5", "#10b981"), flex: 1}}>문 추가</button>
              </div>
            </div>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 캔버스 */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        <div ref={canvasRef} style={{...canvasS, backgroundColor: canvasBg}} 
          onMouseDown={(e) => {
            if (!isAdmin || e.target !== canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setSelectedIds([]);
          }} 
          onMouseMove={(e) => {
            if (!dragStart || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }} 
          onMouseUp={() => {
            if (dragStart && dragEnd) {
              const left = Math.min(dragStart.x, dragEnd.x); const right = Math.max(dragStart.x, dragEnd.x);
              const top = Math.min(dragStart.y, dragEnd.y); const bottom = Math.max(dragStart.y, dragEnd.y);
              const inRange = currentItems.filter(i => i.x >= left && i.x <= right && i.y >= top && i.y <= bottom).map(i => i.id);
              if(inRange.length > 0) setSelectedIds(inRange);
            }
            setDragStart(null); setDragEnd(null);
          }}>
          {currentItems.map((item) => (
            <Draggable key={item.id} position={{ x: item.x, y: item.y }} 
              onStart={() => { if(!selectedIds.includes(item.id)) setSelectedIds([item.id]); }}
              onDrag={(e, data) => {
                const dx = data.x - item.x; const dy = data.y - item.y;
                updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
              }} disabled={!isAdmin}>
              <div style={{ position: "absolute", zIndex: selectedIds.includes(item.id) ? 100 : 10 }}>
                <div style={{ 
                  transform: `rotate(${item.rotation}deg)`, width: item.width, height: item.height, 
                  backgroundColor: item.color, opacity: item.opacity,
                  border: selectedIds.includes(item.id) ? "2px solid #2563eb" : "1px solid #ddd",
                  borderRadius: item.type === "door" ? `${item.width}px ${item.width}px 0 0` : "4px", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: item.textColor, fontSize: "11px", fontWeight: "bold"
                }}>{item.name}</div>
              </div>
            </Draggable>
          ))}
          {dragStart && dragEnd && (
            <div style={{ position: "absolute", border: "1px solid #2563eb", backgroundColor: "rgba(37, 99, 235, 0.1)", left: Math.min(dragStart.x, dragEnd.x), top: Math.min(dragStart.y, dragEnd.y), width: Math.abs(dragEnd.x - dragStart.x), height: Math.abs(dragEnd.y - dragStart.y), pointerEvents: "none" }} />
          )}
        </div>
      </div>

      {/* 우측 설정 */}
      {isAdmin && (
        <div style={rightPanelS}>
          {firstSelected ? (
            <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
              <div style={propCardS}><label style={labelS}>이름 / 크기</label>
                <input value={firstSelected.name} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, name: e.target.value} : i))} style={{...inputS, marginBottom: "5px"}} />
                <div style={{display: "flex", gap: "4px"}}>
                  <input type="number" value={firstSelected.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, width: +e.target.value} : i))} style={inputS} />
                  <input type="number" value={firstSelected.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, height: +e.target.value} : i))} style={inputS} />
                </div>
              </div>

              <div style={propCardS}><label style={labelS}>색상 (스포이드 선택 시 추가)</label>
                <div style={paletteS}>
                  {customPalette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i))} style={{...paletteItemS, backgroundColor: c}} />)}
                  <input type="color" value={firstSelected.color} onChange={(e) => {
                    const c = e.target.value; if(!customPalette.includes(c)) setCustomPalette([...customPalette, c].slice(-10));
                    updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i));
                  }} style={colorPickerS} />
                </div>
                <input type="range" min="0" max="1" step="0.1" value={firstSelected.opacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, opacity: +e.target.value} : i))} style={{width: "100%", marginTop: "8px"}} />
              </div>

              <div style={propCardS}><label style={labelS}>조작</label>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px"}}>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 90) % 360} : i))} style={utilBtnS}>90°</button>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 180) % 360} : i))} style={utilBtnS}>180°</button>
                  <button onClick={copySelected} style={{...utilBtnS, gridColumn: "span 2", backgroundColor: "#f0fdf4"}}>복제</button>
                </div>
              </div>
              <button onClick={() => setModalType("changePw")} style={{border: "none", background: "none", color: "#ccc", fontSize: "10px", cursor: "pointer"}}>관리자 비밀번호 변경</button>
            </div>
          ) : <p style={{textAlign: "center", fontSize: "11px", color: "#999", marginTop: "40px"}}>선택된 항목 없음</p>}
        </div>
      )}
    </main>
  );
}

// 스타일
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f1f5f9", overflow: "hidden" };
const sidebarS: any = { width: "220px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "15px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "220px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "15px", overflowY: "auto" };
const canvasS: any = { width: "100%", height: "100%", borderRadius: "10px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden", backgroundColor: "#fff" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "20px", borderRadius: "12px", width: "260px", textAlign: "center" };
const modalInputS: any = { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px", boxSizing: "border-box" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "12px" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "8px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "11px" });
const floorBtnS: any = (act: boolean) => ({ padding: "6px 10px", backgroundColor: act ? "#2563eb" : "#f8fafc", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" });
const floorDelBtnS: any = { border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" };
const addFloorBtnS: any = { padding: "6px", border: "1px dashed #ddd", background: "none", borderRadius: "6px", color: "#999", cursor: "pointer", fontSize: "11px", marginTop: "5px" };
const historyBoxS: any = { padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px", marginBottom: "10px", fontSize: "11px", border: "1px solid #eee" };
const miniDelBtnS: any = { border: "none", background: "none", color: "#ccc", cursor: "pointer" };
const paletteS: any = { display: "flex", flexWrap: "wrap", gap: "5px" };
const paletteItemS: any = { width: "20px", height: "20px", borderRadius: "50%", cursor: "pointer", border: "1px solid #eee" };
const colorPickerS: any = { width: "20px", height: "20px", border: "none", background: "none", cursor: "pointer" };
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", marginBottom: "5px" };
const labelS: any = { fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "5px" };
const inputS: any = { width: "100%", padding: "5px", border: "1px solid #eee", borderRadius: "4px", fontSize: "11px", boxSizing: "border-box" };
const utilBtnS: any = { padding: "6px", border: "1px solid #eee", borderRadius: "4px", fontSize: "10px", cursor: "pointer", backgroundColor: "#fff" };
const titleEditS: any = { fontSize: "14px", fontWeight: "bold", border: "1px solid #2563eb", borderRadius: "6px", width: "100%", marginBottom: "15px", padding: "5px" };
