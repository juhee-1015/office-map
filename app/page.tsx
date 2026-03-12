"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; opacity: number; width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }
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
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItems = useMemo(() => currentItems.filter(i => selectedIds.includes(i.id)), [currentItems, selectedIds]);
  const firstSelected = selectedItems[0];

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

  const addItem = (type: ItemType) => {
    const id = Date.now();
    const newItem: RoomItem = {
      id, type, name: type === "seat" ? "새 좌석" : "", rotation: 0,
      color: type === "seat" ? "#3b82f6" : type === "wall" ? "#333333" : "#94a3b8",
      opacity: 1, width: type === "wall" ? 120 : 45, height: type === "wall" ? 8 : 45, x: 100, y: 100
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
  };

  const selectTeam = (color: string) => {
    const ids = currentItems.filter(i => i.color === color).map(i => i.id);
    setSelectedIds(ids);
  };

  const rotateSelected = () => {
    updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: (i.rotation + 90) % 360 } : i));
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!isAdmin || e.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelectedIds([]);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCanvasMouseUp = () => {
    if (dragStart && dragEnd) {
      const left = Math.min(dragStart.x, dragEnd.x);
      const right = Math.max(dragStart.x, dragEnd.x);
      const top = Math.min(dragStart.y, dragEnd.y);
      const bottom = Math.max(dragStart.y, dragEnd.y);
      const inRange = currentItems.filter(i => i.x >= left && i.x <= right && i.y >= top && i.y <= bottom).map(i => i.id);
      setSelectedIds(inRange);
    }
    setDragStart(null); setDragEnd(null);
  };

  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); }
      else { setModalMsg("비밀번호가 틀렸습니다."); setModalType("alert"); }
    } else if (modalType === "saveVersion") {
      setSavedVersions([{ id: `V-${Date.now()}`, name: modalInput || "새 버전", date: new Date().toLocaleString(), data: JSON.parse(JSON.stringify(floors)) }, ...savedVersions]);
      setModalType(null);
    } else if (modalType === "confirm") {
      updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
      setSelectedIds([]); setModalType(null);
    } else { setModalType(null); }
    setModalInput("");
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {/* 모달 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "20px", fontWeight: "bold" }}>
              {modalType === "login" ? "관리자 인증" : modalType === "confirm" ? "삭제 확인" : "버전 저장"}
            </h3>
            <div style={{ padding: "0 25px" }}>
              {(modalType === "login" || modalType === "saveVersion") && (
                <input type={modalType === "login" ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} style={modalInputS} onKeyDown={(e) => e.key === "Enter" && handleModalConfirm()} placeholder="입력하세요" />
              )}
              {(modalType === "confirm" || modalType === "alert") && <p style={{fontSize: "14px"}}>{modalMsg}</p>}
              <div style={{ display: "flex", gap: "10px", marginTop: "25px", justifyContent: "center" }}>
                <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
                <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 왼쪽 사이드바 */}
      <div style={sidebarS}>
        <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} disabled={!isAdmin} />
        
        {isAdmin && (
          <div style={statsCardS}>
            <div style={{fontWeight: "800", borderBottom: "1px solid #eee", paddingBottom: "5px", marginBottom: "8px"}}>총 {stats.total}석 (부서 클릭 시 전체선택)</div>
            {Object.entries(stats.teams).map(([color, count]: any) => (
              <div key={color} onClick={() => selectTeam(color)} style={teamRowS}>
                <span style={{display: "flex", alignItems: "center", gap: "5px"}}><div style={{width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px"}} />{teamNames[color] || "부서명 미지정"}</span>
                <b>{count}석</b>
              </div>
            ))}
          </div>
        )}

        <div style={{marginBottom: "20px"}}>
          <label style={labelS}>층 관리</label>
          {floors.map(f => (
            <div key={f.id} style={{display: "flex", gap: "4px", marginBottom: "4px"}}>
              <button onClick={() => setActiveFloorId(f.id)} style={floorBtnS(activeFloorId === f.id)}>{f.displayName}</button>
              {isAdmin && <button onClick={() => setFloors(floors.filter(it => it.id !== f.id))} style={{color: "#ef4444", border: "none", background: "none", cursor: "pointer"}}>×</button>}
            </div>
          ))}
          {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: "새 층", items: [] }])} style={addFloorBtnS}>층 추가</button>}
        </div>

        {isAdmin && (
          <div style={{marginBottom: "20px"}}>
            <label style={labelS}>히스토리</label>
            <div style={versionListS}>
              {savedVersions.map(v => (
                <div key={v.id} onClick={() => setFloors(v.data)} style={versionItemS}>
                  <div style={{flex: 1}}><b>{v.name}</b><br/><small>{v.date}</small></div>
                  <button onClick={(e) => { e.stopPropagation(); setSavedVersions(savedVersions.filter(sv => sv.id !== v.id)); }} style={{color: "#ef4444", border: "none", background: "none", fontSize: "10px", cursor: "pointer"}}>삭제</button>
                </div>
              ))}
            </div>
            <button onClick={() => setModalType("saveVersion")} style={saveVerBtnS}>현재 배치 저장</button>
          </div>
        )}

        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <div style={{display: "grid", gridTemplateColumns: "1fr", gap: "5px"}}>
              <button onClick={() => addItem("seat")} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <div style={{display: "flex", gap: "5px"}}>
                <button onClick={() => addItem("wall")} style={{...actionBtnS("#f8fafc", "#333"), flex: 1}}>벽체 추가</button>
                <button onClick={() => addItem("door")} style={{...actionBtnS("#ecfdf5", "#10b981"), flex: 1}}>문 추가</button>
              </div>
            </div>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 캔버스 영역 */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        <div ref={canvasRef} style={canvasS} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp}>
          {currentItems.map((item) => (
            <DraggableComponent 
              key={item.id} item={item} isSelected={selectedIds.includes(item.id)} isAdmin={isAdmin} 
              onSelect={(e:any) => { if(e.shiftKey) setSelectedIds([...selectedIds, item.id]); else setSelectedIds([item.id]); }} 
              onDrag={(data:any) => {
                const dx = data.x - item.x; const dy = data.y - item.y;
                updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
              }} 
            />
          ))}
          {dragStart && dragEnd && (
            <div style={{ position: "absolute", border: "1px solid #2563eb", backgroundColor: "rgba(37, 99, 235, 0.1)", left: Math.min(dragStart.x, dragEnd.x), top: Math.min(dragStart.y, dragEnd.y), width: Math.abs(dragEnd.x - dragStart.x), height: Math.abs(dragEnd.y - dragStart.y), pointerEvents: "none" }} />
          )}
        </div>
      </div>

      {/* 오른쪽 상세 설정 */}
      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{fontSize: "14px", fontWeight: "bold", marginBottom: "15px"}}>상세 설정</h2>
          {firstSelected ? (
            <div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
              <div style={propCardS}>
                <label style={labelS}>이름 및 부서</label>
                <input value={firstSelected.name} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, name: e.target.value} : i))} style={inputS} placeholder="좌석 이름" />
                <input value={teamNames[firstSelected.color] || ""} onChange={(e) => setTeamNames({...teamNames, [firstSelected.color]: e.target.value})} style={{...inputS, marginTop: "5px"}} placeholder="부서명 입력" />
              </div>
              <div style={propCardS}>
                <label style={labelS}>색상 및 투명도</label>
                <div style={{display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px"}}>
                  <input type="color" value={firstSelected.color} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: e.target.value} : i))} style={colorPickerS} />
                  <input value={firstSelected.color.toUpperCase()} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: e.target.value} : i))} style={{...inputS, flex: 1}} />
                </div>
                <label style={{fontSize: "10px", color: "#94a3b8"}}>투명도: {Math.round(firstSelected.opacity * 100)}%</label>
                <input type="range" min="0.1" max="1" step="0.1" value={firstSelected.opacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, opacity: +e.target.value} : i))} style={{width: "100%"}} />
              </div>
              <div style={propCardS}>
                <label style={labelS}>크기 및 정렬</label>
                <div style={{display: "flex", gap: "5px", marginBottom: "8px"}}>
                  <input type="number" value={firstSelected.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, width: +e.target.value} : i))} style={inputS} />
                  <input type="number" value={firstSelected.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, height: +e.target.value} : i))} style={inputS} />
                </div>
                <button onClick={rotateSelected} style={rotateBtnS}>↻ 90도 회전</button>
              </div>
              <button onClick={() => { setModalMsg("선택한 항목들을 삭제하시겠습니까?"); setModalType("confirm"); }} style={deleteBtnS}>선택 항목 삭제</button>
            </div>
          ) : <p style={{color: "#94a3b8", fontSize: "12px", textAlign: "center", marginTop: "50px"}}>항목을 선택하세요.</p>}
        </div>
      )}
    </main>
  );
}

function DraggableComponent({ item, isSelected, isAdmin, onSelect, onDrag }: any) {
  const nodeRef = useRef(null);
  return (
    <Draggable nodeRef={nodeRef} position={{ x: item.x, y: item.y }} onStart={onSelect} onDrag={(e, data) => onDrag(data)} disabled={!isAdmin}>
      <div ref={nodeRef} style={{ position: "absolute", zIndex: isSelected ? 100 : 10, transform: `rotate(${item.rotation}deg)` }}>
        <div style={{ 
          width: item.width, height: item.height, backgroundColor: item.color, opacity: item.opacity,
          border: isSelected ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.1)", 
          borderRadius: item.type === "seat" ? "6px" : "0", 
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold", 
          textAlign: "center", wordBreak: "break-all", padding: "4px"
        }}>
          {item.name}
        </div>
      </div>
    </Draggable>
  );
}

// 스타일
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f8fafc" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "240px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "20px" };
const canvasS: any = { width: "100%", height: "100%", backgroundColor: "#fff", borderRadius: "15px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "30px 0", borderRadius: "20px", width: "320px", textAlign: "center" };
const modalInputS: any = { width: "80%", padding: "10px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "10px" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px 20px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" });
const subBtnS: any = { padding: "10px 20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "12px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });
const floorBtnS: any = (act: boolean) => ({ flex: 1, padding: "8px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" });
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "15px" };
const teamRowS: any = { display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px", cursor: "pointer", padding: "4px", borderRadius: "4px", backgroundColor: "#fff", border: "1px solid #eee" };
const versionListS: any = { maxHeight: "150px", overflowY: "auto", border: "1px solid #eee", padding: "5px", borderRadius: "5px", marginBottom: "5px" };
const versionItemS: any = { display: "flex", alignItems: "center", padding: "8px", borderBottom: "1px solid #f9f9f9", cursor: "pointer", fontSize: "11px" };
const saveVerBtnS: any = { width: "100%", padding: "6px", background: "#f1f5f9", border: "none", borderRadius: "4px", fontSize: "11px", cursor: "pointer" };
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "5px", display: "block" };
const inputS: any = { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "12px" };
const colorPickerS: any = { width: "36px", height: "36px", padding: "0", border: "2px solid #eee", borderRadius: "4px", cursor: "pointer", backgroundColor: "transparent" };
const rotateBtnS: any = { width: "100%", padding: "8px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" };
const deleteBtnS: any = { padding: "10px", backgroundColor: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" };
const titleEditS: any = { fontSize: "16px", fontWeight: "bold", border: "1px solid #2563eb", borderRadius: "4px", width: "100%", marginBottom: "15px", padding: "4px" };
const addFloorBtnS: any = { width: "100%", padding: "6px", border: "1px dashed #ddd", background: "none", borderRadius: "6px", color: "#94a3b8", cursor: "pointer", fontSize: "11px", marginTop: "5px" };
