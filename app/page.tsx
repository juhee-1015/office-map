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
  const [canvasBg, setCanvasBg] = useState("#ffffff");

  const [modalType, setModalType] = useState<"login" | "changePw" | "saveVersion" | null>(null);
  const [modalInput, setModalInput] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6"]);
  const [history, setHistory] = useState<FloorInfo[][]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const [draggedFloorIdx, setDraggedFloorIdx] = useState<number | null>(null);

  useEffect(() => { setHasMounted(true); }, []);

  // --- 헬퍼 함수 ---
  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItems = useMemo(() => currentItems.filter(i => selectedIds.includes(i.id)), [currentItems, selectedIds]);
  const firstSelected = selectedItems[0];

  const saveHistory = () => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(floors))]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFloors(previous);
    setHistory(prev => prev.slice(0, -1));
  };

  const updateItems = (newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
  };

  // --- 핵심 기능 함수 (이 부분이 누락되면 에러가 납니다) ---
  const addItem = (type: ItemType) => {
    saveHistory();
    const id = Date.now();
    const newItem: RoomItem = {
      id, type, name: type === "seat" ? "새 좌석" : "", rotation: 0,
      color: type === "seat" ? "#3b82f6" : "#333333",
      textColor: "#ffffff", opacity: 1, textOpacity: 1, width: type === "wall" ? 120 : 45, height: type === "wall" ? 8 : 45, x: 150, y: 150
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
  };

  const alignObjects = (type: 'horizontal' | 'vertical') => {
    if (selectedItems.length < 2) return;
    saveHistory();
    if (type === 'horizontal') {
      const avgY = selectedItems.reduce((acc, cur) => acc + cur.y, 0) / selectedItems.length;
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, y: avgY } : i));
    } else {
      const avgX = selectedItems.reduce((acc, cur) => acc + cur.x, 0) / selectedItems.length;
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: avgX } : i));
    }
  };

  // --- 단축키 핸들러 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (isAdmin) {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
          saveHistory();
          updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
          setSelectedIds([]);
        }
        if (e.ctrlKey && e.key === "z") undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, selectedIds, currentItems, history]);

  const stats = useMemo(() => {
    const allSeats = floors.reduce((acc, f) => acc + f.items.filter(i => i.type === "seat").length, 0);
    const floorSeats = currentItems.filter(i => i.type === "seat");
    const counts = floorSeats.reduce((acc: any, cur) => {
      acc[cur.color] = (acc[cur.color] || 0) + 1;
      return acc;
    }, {});
    return { totalAll: allSeats, totalFloor: floorSeats.length, counts };
  }, [floors, currentItems]);

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
      {/* 모달 레이어 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{marginBottom: "15px", fontWeight: "bold"}}>{modalType === "changePw" ? "관리자 비밀번호 변경" : "입력"}</h3>
            <input type={(modalType === "login" || modalType === "changePw") ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} style={modalInputS} autoFocus />
            <div style={{display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px"}}>
              <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
              <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 왼쪽 사이드바 */}
      <div style={sidebarS}>
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{fontWeight: "bold", fontSize: "16px", marginBottom: "20px"}}>{appTitle}</h2>}
        
        <div style={{marginBottom: "15px"}}>
          <label style={labelS}>층 이동 {isAdmin && "(드래그 순서 변경)"}</label>
          <div style={{display: "flex", flexDirection: "column", gap: "4px"}}>
            {floors.map((f, idx) => (
              <div key={f.id} draggable={isAdmin} 
                onDragStart={() => isAdmin && setDraggedFloorIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); if(isAdmin && draggedFloorIdx !== null && draggedFloorIdx !== idx) { 
                  const newFloors = [...floors];
                  const draggedItem = newFloors[draggedFloorIdx];
                  newFloors.splice(draggedFloorIdx, 1);
                  newFloors.splice(idx, 0, draggedItem);
                  setFloors(newFloors);
                  setDraggedFloorIdx(idx);
                }}}
                style={{display: "flex", gap: "4px", alignItems: "center"}}>
                {isAdmin ? (
                  <input value={f.displayName} onChange={(e) => setFloors(floors.map(it => it.id === f.id ? {...it, displayName: e.target.value} : it))} style={{...floorBtnS(activeFloorId === f.id), flex: 1, border: "1px solid #e2e8f0"}} />
                ) : (
                  <button onClick={() => setActiveFloorId(f.id)} style={{...floorBtnS(activeFloorId === f.id), flex: 1}}>{f.displayName}</button>
                )}
                {isAdmin && <button onClick={() => floors.length > 1 && setFloors(floors.filter(it => it.id !== f.id))} style={floorDelBtnS}>×</button>}
              </div>
            ))}
            {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: "새 층", items: [] }])} style={addFloorBtnS}>+ 층 추가</button>}
          </div>
        </div>

        {/* 통계 */}
        <div style={statsCardS}>
          <div style={{fontWeight: "bold", fontSize: "12px", marginBottom: "5px"}}>📊 좌석 통계</div>
          <div style={{fontSize: "11px", color: "#64748b", marginBottom: "8px"}}>전체: {stats.totalAll}석 / 현재 층: {stats.totalFloor}석</div>
          {Object.entries(stats.counts).map(([color, count]: any) => (
            <div key={color} style={teamRowS}>
              <div style={{display: "flex", alignItems: "center", gap: "5px", flex: 1}}>
                <div style={{width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px"}} />
                <input value={teamNames[color] || ""} placeholder="부서명" onChange={(e) => setTeamNames({...teamNames, [color]: e.target.value})} style={teamInputS} />
              </div>
              <b style={{fontSize: "10px"}}>{count}석</b>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div style={historyBoxS}>
            <div style={{display: "flex", justifyContent: "space-between", marginBottom: "5px"}}>
              <span style={{fontWeight: "bold"}}>버전 히스토리</span>
              <button onClick={() => setModalType("saveVersion")} style={{fontSize: "10px"}}>저장</button>
            </div>
            {savedVersions.map(v => (
              <div key={v.id} style={{display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "3px"}}>
                <span onClick={() => confirm(`${v.name} 버전으로 복구하시겠습니까?`) && setFloors(v.data)} style={{cursor: "pointer", color: "#2563eb"}}>{v.name}</span>
                <button onClick={() => setSavedVersions(savedVersions.filter(it => it.id !== v.id))} style={{border: "none", background: "none", color: "#ef4444", cursor: "pointer"}}>삭제</button>
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

      {/* 중앙 캔버스 */}
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
              }} onStop={saveHistory} disabled={!isAdmin}>
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

      {/* 오른쪽 상세 설정 */}
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

              <div style={propCardS}><label style={labelS}>배경색 / 글자색</label>
                <div style={paletteS}>
                  {customPalette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i))} style={{...paletteItemS, backgroundColor: c}} />)}
                  <input type="color" value={firstSelected.color} onChange={(e) => {
                    const c = e.target.value; if(!customPalette.includes(c)) setCustomPalette([...customPalette, c].slice(-10));
                    updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i));
                  }} style={colorPickerS} />
                </div>
                <div style={{marginTop: "8px", display: "flex", alignItems: "center", gap: "5px"}}>
                  <span style={{fontSize: "10px"}}>글자색:</span>
                  <input type="color" value={firstSelected.textColor} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, textColor: e.target.value} : i))} style={{...colorPickerS, width: "30px"}} />
                </div>
              </div>

              <div style={propCardS}><label style={labelS}>정렬 / 조작</label>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px"}}>
                  <button onClick={() => alignObjects('horizontal')} style={utilBtnS}>가로정렬</button>
                  <button onClick={() => alignObjects('vertical')} style={utilBtnS}>세로정렬</button>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 90) % 360} : i))} style={utilBtnS}>90°</button>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 180) % 360} : i))} style={utilBtnS}>180°</button>
                </div>
                <button onClick={() => { saveHistory(); const newItems = [...currentItems]; selectedItems.forEach(item => newItems.push({...item, id: Date.now()+Math.random(), x: item.x+20, y: item.y+20})); updateItems(newItems); }} style={{...utilBtnS, width: "100%", marginTop: "5px", backgroundColor: "#f0fdf4"}}>복제</button>
              </div>

              <button onClick={undo} style={{...utilBtnS, backgroundColor: "#fffbeb"}}>Undo (Ctrl+Z)</button>
              <button onClick={() => setModalType("changePw")} style={{border: "none", background: "none", color: "#ccc", fontSize: "10px", cursor: "pointer", marginTop: "10px"}}>관리자 비밀번호 변경</button>
            </div>
          ) : <p style={{textAlign: "center", fontSize: "11px", color: "#999", marginTop: "40px"}}>항목을 선택하세요.</p>}
        </div>
      )}
    </main>
  );
}

// --- 스타일 객체 ---
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f1f5f9", overflow: "hidden" };
const sidebarS: any = { width: "220px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "15px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "220px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "15px", overflowY: "auto" };
const canvasS: any = { width: "100%", height: "100%", borderRadius: "10px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden", backgroundColor: "#fff", backgroundImage: "radial-gradient(#f1f5f9 1px, transparent 1px)", backgroundSize: "20px 20px" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "20px", borderRadius: "12px", width: "260px", textAlign: "center" };
const modalInputS: any = { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px", boxSizing: "border-box" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "12px" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "8px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "11px" });
const floorBtnS: any = (act: boolean) => ({ padding: "6px 10px", backgroundColor: act ? "#2563eb" : "#f8fafc", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", textAlign: "left" });
const floorDelBtnS: any = { border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" };
const addFloorBtnS: any = { padding: "6px", border: "1px dashed #ddd", background: "none", borderRadius: "6px", color: "#999", cursor: "pointer", fontSize: "11px", marginTop: "5px" };
const statsCardS: any = { padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px", marginBottom: "10px", border: "1px solid #eee" };
const teamRowS: any = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" };
const teamInputS: any = { border: "none", borderBottom: "1px solid #ddd", fontSize: "10px", backgroundColor: "transparent", width: "70px" };
const historyBoxS: any = { padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px", marginBottom: "10px", fontSize: "11px", border: "1px solid #eee" };
const paletteS: any = { display: "flex", flexWrap: "wrap", gap: "5px" };
const paletteItemS: any = { width: "18px", height: "18px", borderRadius: "50%", cursor: "pointer", border: "1px solid #eee" };
const colorPickerS: any = { width: "20px", height: "20px", border: "none", background: "none", cursor: "pointer" };
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", marginBottom: "5px" };
const labelS: any = { fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "5px" };
const inputS: any = { width: "100%", padding: "5px", border: "1px solid #eee", borderRadius: "4px", fontSize: "11px", boxSizing: "border-box" };
const utilBtnS: any = { padding: "6px", border: "1px solid #eee", borderRadius: "4px", fontSize: "10px", cursor: "pointer", backgroundColor: "#fff" };
const titleEditS: any = { fontSize: "14px", fontWeight: "bold", border: "1px solid #2563eb", borderRadius: "6px", width: "100%", marginBottom: "15px", padding: "5px" };
