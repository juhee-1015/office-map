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
  const [draggedFloorIdx, setDraggedFloorIdx] = useState<number | null>(null);

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

  // --- [복구] 정렬 및 회전 기능 ---
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

  const stats = useMemo(() => {
    const floorSeats = currentItems.filter(i => i.type === "seat");
    const counts = floorSeats.reduce((acc: any, cur) => { acc[cur.color] = (acc[cur.color] || 0) + 1; return acc; }, {});
    return { totalAll: floors.reduce((acc, f) => acc + f.items.filter(i => i.type === "seat").length, 0), totalFloor: floorSeats.length, counts };
  }, [floors, currentItems]);

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
      {/* 모달 레이어 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{marginBottom: "15px", fontWeight: "bold"}}>
              {modalType === "login" ? "관리자 로그인" : 
               modalType === "changePw" ? "비밀번호 변경" : 
               modalType === "restoreConfirm" ? "데이터 복구 확인" : "버전 저장"}
            </h3>
            {modalType === "restoreConfirm" ? (
              <p style={{fontSize: "13px", color: "#666", marginBottom: "20px"}}>히스토리 버전으로 복구하시겠습니까?</p>
            ) : (
              <input type={(modalType === "login" || modalType === "changePw") ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} style={modalInputS} autoFocus placeholder="내용을 입력하세요" />
            )}
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
        
        <div style={{marginBottom: "15px"}}>
          <label style={labelS}>층 이동 {isAdmin && "(드래그 순서 변경)"}</label>
          <div style={{display: "flex", flexDirection: "column", gap: "4px"}}>
            {floors.map((f, idx) => (
              <div key={f.id} draggable={isAdmin} 
                onDragStart={() => isAdmin && setDraggedFloorIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); if(isAdmin && draggedFloorIdx !== null && draggedFloorIdx !== idx) { 
                  const newFloors = [...floors]; const item = newFloors[draggedFloorIdx];
                  newFloors.splice(draggedFloorIdx, 1); newFloors.splice(idx, 0, item);
                  setFloors(newFloors); setDraggedFloorIdx(idx);
                }}}
                style={{display: "flex", gap: "4px", alignItems: "center"}}>
                {isAdmin ? <input value={f.displayName} onChange={(e) => setFloors(floors.map(it => it.id === f.id ? {...it, displayName: e.target.value} : it))} style={{...floorBtnS(activeFloorId === f.id), flex: 1, border: "1px solid #e2e8f0"}} /> : <button onClick={() => setActiveFloorId(f.id)} style={{...floorBtnS(activeFloorId === f.id), flex: 1}}>{f.displayName}</button>}
              </div>
            ))}
            {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: "새 층", items: [] }])} style={addFloorBtnS}>+ 층 추가</button>}
          </div>
        </div>

        {isAdmin && (
          <>
            <div style={statsCardS}>
              <div style={{fontWeight: "bold", fontSize: "12px", marginBottom: "5px"}}>📊 좌석 통계</div>
              {Object.entries(stats.counts).map(([color, count]: any) => (
                <div key={color} style={{...teamRowS, cursor: "pointer"}} onClick={() => setSelectedIds(currentItems.filter(i => i.color === color).map(i => i.id))}>
                  <div style={{display: "flex", alignItems: "center", gap: "5px"}}>
                    <div style={{width: "12px", height: "12px", backgroundColor: color, borderRadius: "50%"}} />
                    <input value={teamNames[color] || ""} placeholder="부서명" onChange={(e) => setTeamNames({...teamNames, [color]: e.target.value})} style={teamInputS} onClick={(e) => e.stopPropagation()} />
                  </div>
                  <b style={{fontSize: "10px"}}>{count}석</b>
                </div>
              ))}
            </div>

            <div style={historyBoxS}>
              <b>버전 히스토리</b>
              <div style={{maxHeight: "80px", overflowY: "auto", marginTop: "5px"}}>
                {savedVersions.map(v => (
                  <div key={v.id} style={{display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "3px"}}>
                    <span onClick={() => { setPendingRestore(v.data); setModalType("restoreConfirm"); }} style={{cursor: "pointer", color: "#2563eb"}}>{v.name}</span>
                    <button onClick={() => setSavedVersions(savedVersions.filter(it => it.id !== v.id))} style={{border: "none", color: "#ef4444", cursor: "pointer"}}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setModalType("saveVersion")} style={{width: "100%", fontSize: "10px", marginTop: "5px"}}>현재 상태 저장</button>
            </div>
          </>
        )}

        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <>
              <button onClick={() => { saveHistory(); const id = Date.now(); updateItems([...currentItems, { id, type: "seat", name: "새 좌석", rotation: 0, color: "#3b82f6", textColor: "#fff", opacity: 1, textOpacity: 1, width: 45, height: 45, x: 100, y: 100 }]); setSelectedIds([id]); }} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <button onClick={() => { saveHistory(); const id = Date.now(); updateItems([...currentItems, { id, type: "wall", name: "", rotation: 0, color: "#333", textColor: "#fff", opacity: 1, textOpacity: 1, width: 150, height: 10, x: 100, y: 100 }]); setSelectedIds([id]); }} style={actionBtnS("#f8fafc", "#333")}>벽체 추가</button>
            </>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 메인 영역 */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        {isAdmin && <button onClick={undo} style={floatingUndoBtnS}>↩ 되돌리기</button>}
        <div ref={canvasRef} style={canvasS} 
          onMouseDown={(e) => {
            if (!isAdmin || e.target !== canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setSelectedIds([]);
          }} 
          onMouseMove={(e) => { if (dragStart && canvasRef.current) { const rect = canvasRef.current.getBoundingClientRect(); setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }}} 
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
            <Draggable key={item.id} position={{ x: item.x, y: item.y }} onStart={() => { if(!selectedIds.includes(item.id)) setSelectedIds([item.id]); }}
              onDrag={(e, data) => { const dx = data.x - item.x; const dy = data.y - item.y; updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)); }} onStop={saveHistory} disabled={!isAdmin}>
              <div style={{ position: "absolute", zIndex: selectedIds.includes(item.id) ? 100 : 10 }}>
                <div style={{ transform: `rotate(${item.rotation}deg)`, width: item.width, height: item.height, backgroundColor: item.color, opacity: item.opacity, border: selectedIds.includes(item.id) ? "2px solid #2563eb" : "1px solid #ddd", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: item.textColor, fontSize: "11px", fontWeight: "bold" }}>{item.name}</div>
              </div>
            </Draggable>
          ))}
          {dragStart && dragEnd && <div style={{ position: "absolute", border: "1px solid #2563eb", backgroundColor: "rgba(37, 99, 235, 0.1)", left: Math.min(dragStart.x, dragEnd.x), top: Math.min(dragStart.y, dragEnd.y), width: Math.abs(dragEnd.x - dragStart.x), height: Math.abs(dragEnd.y - dragStart.y), pointerEvents: "none" }} />}
        </div>
      </div>

      {/* 우측 설정 (정렬/회전 복구됨!) */}
      {isAdmin && firstSelected && (
        <div style={rightPanelS}>
          <div style={propCardS}><label style={labelS}>이름 및 크기</label>
            <input value={firstSelected.name} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, name: e.target.value} : i))} style={inputS} />
            <div style={{display: "flex", gap: "4px", marginTop: "5px"}}><input type="number" value={firstSelected.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, width: +e.target.value} : i))} style={inputS} /><input type="number" value={firstSelected.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, height: +e.target.value} : i))} style={inputS} /></div>
          </div>
          
          <div style={propCardS}><label style={labelS}>색상 및 투명도</label>
            <div style={paletteS}>{customPalette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i))} style={{...paletteItemS, backgroundColor: c}} />)}</div>
            <input type="range" min="0" max="1" step="0.1" value={firstSelected.opacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, opacity: +e.target.value} : i))} style={{width: "100%", marginTop: "10px"}} />
          </div>

          <div style={propCardS}><label style={labelS}>편집 도구 (정렬/회전)</label>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px"}}>
              <button onClick={() => alignObjects('horizontal')} style={utilBtnS}>가로 정렬</button>
              <button onClick={() => alignObjects('vertical')} style={utilBtnS}>세로 정렬</button>
              <button onClick={() => rotateObjects(90)} style={utilBtnS}>90° 회전</button>
              <button onClick={() => rotateObjects(180)} style={utilBtnS}>180° 회전</button>
            </div>
            <button onClick={duplicateSelected} style={{...utilBtnS, width: "100%", backgroundColor: "#f0fdf4", fontWeight: "bold", marginBottom: "5px"}}>선택 복제</button>
            <button onClick={() => updateItems(currentItems.filter(i => !selectedIds.includes(i.id)))} style={{...utilBtnS, width: "100%", backgroundColor: "#fef2f2", color: "#ef4444"}}>삭제</button>
          </div>
        </div>
      )}
    </main>
  );
}

// 스타일 객체
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f1f5f9" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", padding: "15px", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "230px", backgroundColor: "#fff", padding: "15px", borderLeft: "1px solid #e2e8f0", overflowY: "auto" };
const canvasS: any = { flex: 1, height: "100%", borderRadius: "12px", border: "1px solid #e2e8f0", position: "relative", backgroundColor: "#fff" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "20px", borderRadius: "12px", width: "300px", textAlign: "center" };
const modalInputS: any = { width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "8px", boxSizing: "border-box" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "12px" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "12px", marginBottom: "5px" });
const floorBtnS: any = (act: boolean) => ({ padding: "8px", backgroundColor: act ? "#2563eb" : "#f8fafc", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left" });
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "10px", border: "1px solid #e2e8f0" };
const teamRowS: any = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" };
const teamInputS: any = { border: "none", background: "none", fontSize: "11px", width: "80px" };
const historyBoxS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "10px", fontSize: "11px" };
const paletteS: any = { display: "flex", gap: "5px", flexWrap: "wrap" };
const paletteItemS: any = { width: "20px", height: "20px", borderRadius: "50%", cursor: "pointer" };
const colorPickerS: any = { border: "none", background: "none" };
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", marginBottom: "8px" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "5px" };
const inputS: any = { width: "100%", padding: "5px", border: "1px solid #eee", borderRadius: "4px", fontSize: "12px" };
const utilBtnS: any = { padding: "8px", border: "1px solid #eee", borderRadius: "6px", fontSize: "11px", cursor: "pointer", backgroundColor: "#fff" };
const titleEditS: any = { fontSize: "15px", fontWeight: "bold", border: "2px solid #2563eb", borderRadius: "8px", width: "100%", marginBottom: "15px", padding: "8px" };
const floatingUndoBtnS: any = { position: "absolute", top: "20px", right: "20px", zIndex: 100, padding: "8px 15px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "20px", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" };
