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

  const [modalType, setModalType] = useState<"login" | "changePw" | "alert" | "confirm" | "saveVersion" | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMsg, setModalMsg] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  
  const palette = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#64748b", "#333333"];

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
    const counts = seats.reduce((acc: any, cur) => {
      acc[cur.color] = (acc[cur.color] || 0) + 1;
      return acc;
    }, {});
    return { total: seats.length, counts };
  }, [currentItems]);

  const updateItems = (newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
  };

  const addItem = (type: ItemType) => {
    const id = Date.now();
    const newItem: RoomItem = {
      id, type, name: type === "seat" ? "새 좌석" : "", rotation: 0,
      color: type === "seat" ? "#3b82f6" : type === "wall" ? "#333333" : "#e2e8f0",
      textColor: "#ffffff", opacity: 1, textOpacity: 1, width: type === "wall" ? 120 : 45, height: type === "wall" ? 8 : 45, x: 150, y: 150
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
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

  const removeFloor = (id: string) => {
    if (floors.length <= 1) {
      setModalMsg("최소 한 개의 층은 존재해야 합니다.");
      setModalType("alert");
      return;
    }
    if (confirm("이 층의 모든 데이터가 삭제됩니다. 삭제하시겠습니까?")) {
      const newFloors = floors.filter(f => f.id !== id);
      setFloors(newFloors);
      if (activeFloorId === id) setActiveFloorId(newFloors[0].id);
    }
  };

  const selectTeamGroup = (color: string) => {
    const teamIds = currentItems.filter(i => i.type === "seat" && i.color === color).map(i => i.id);
    setSelectedIds(teamIds);
  };

  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); }
      else { setModalMsg("비밀번호가 틀렸습니다."); setModalType("alert"); }
    } else if (modalType === "changePw") {
      if (modalInput.trim() === "") return;
      setAdminPassword(modalInput); setModalType(null);
    } else if (modalType === "confirm") {
      updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
      setSelectedIds([]); setModalType(null);
    } else if (modalType === "saveVersion") {
      setSavedVersions([{ id: `V-${Date.now()}`, name: modalInput || "새 버전", date: new Date().toLocaleString(), data: JSON.parse(JSON.stringify(floors)) }, ...savedVersions]);
      setModalType(null);
    } else { setModalType(null); }
    setModalInput("");
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {/* 모달 영역 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{marginBottom: "15px", fontWeight: "bold"}}>{modalType === "changePw" ? "비번 변경" : modalType === "confirm" ? "삭제 확인" : "정보 입력"}</h3>
            {(modalType === "login" || modalType === "saveVersion" || modalType === "changePw") && (
              <input type={modalType === "login" ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} style={modalInputS} autoFocus placeholder="내용 입력 후 엔터" />
            )}
            {(modalType === "confirm" || modalType === "alert") && <p>{modalMsg}</p>}
            <div style={{display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px"}}>
              <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인 (Enter)</button>
              <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 좌측 사이드바 */}
      <div style={sidebarS}>
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{fontWeight: "bold", fontSize: "16px", marginBottom: "20px"}}>{appTitle}</h2>}
        
        <div style={{marginBottom: "20px"}}>
          <label style={labelS}>층 이동</label>
          <div style={{display: "flex", flexWrap: "wrap", gap: "5px"}}>
            {floors.map(f => (
              <button key={f.id} onClick={() => setActiveFloorId(f.id)} style={floorBtnS(activeFloorId === f.id)}>{f.displayName}</button>
            ))}
          </div>
          {isAdmin && (
              <div style={{marginTop: "10px", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px"}}>
                <label style={labelS}>층 관리(이름 수정/삭제)</label>
                {floors.map(f => (
                  <div key={f.id} style={{display: "flex", gap: "4px", marginBottom: "4px"}}>
                    <input value={f.displayName} onChange={(e) => setFloors(floors.map(it => it.id === f.id ? {...it, displayName: e.target.value} : it))} style={{...inputS, flex: 1}} />
                    <button onClick={() => removeFloor(f.id)} style={floorDelBtnS}>×</button>
                  </div>
                ))}
                <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: "새 층", items: [] }])} style={addFloorBtnS}>+ 층 추가</button>
              </div>
          )}
        </div>

        {isAdmin && (
          <div style={statsCardS}>
            <div style={{fontWeight: "bold", borderBottom: "1px solid #eee", paddingBottom: "5px", marginBottom: "8px"}}>📊 부서 통계 (클릭 시 그룹선택)</div>
            {Object.entries(stats.counts).map(([color, count]: any) => (
              <div key={color} style={{...teamRowS, cursor: 'pointer'}} onClick={() => selectTeamGroup(color)}>
                <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
                  <div style={{width: "12px", height: "12px", backgroundColor: color, borderRadius: "2px"}} />
                  <input value={teamNames[color] || ""} placeholder="부서명" onChange={(e) => setTeamNames({...teamNames, [color]: e.target.value})} style={teamInputS} onClick={(e) => e.stopPropagation()} />
                </div>
                <b style={{fontSize: "12px"}}>{count}석</b>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <div style={{display: "grid", gridTemplateColumns: "1fr", gap: "5px"}}>
              <div style={{display: "flex", gap: "5px", alignItems: "center", marginBottom: "5px"}}>
                <label style={{fontSize: "11px"}}>배경색:</label>
                <input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} style={{flex: 1, height: "25px", border: "none", cursor: "pointer"}} />
                <div style={eyedropperS} />
              </div>
              <button onClick={() => addItem("seat")} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <div style={{display: "flex", gap: "5px"}}>
                <button onClick={() => addItem("wall")} style={{...actionBtnS("#f8fafc", "#333"), flex: 1}}>벽체 추가</button>
                <button onClick={() => addItem("door")} style={{...actionBtnS("#ecfdf5", "#10b981"), flex: 1}}>문 추가(반원)</button>
              </div>
            </div>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 메인 캔버스 */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        <div ref={canvasRef} style={{...canvasS, backgroundColor: canvasBg}} onMouseDown={(e) => {
          if (!isAdmin || e.target !== canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setSelectedIds([]);
        }} onMouseMove={(e) => {
          if (!dragStart || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }} onMouseUp={() => {
          if (dragStart && dragEnd) {
            const left = Math.min(dragStart.x, dragEnd.x); const right = Math.max(dragStart.x, dragEnd.x);
            const top = Math.min(dragStart.y, dragEnd.y); const bottom = Math.max(dragStart.y, dragEnd.y);
            const inRange = currentItems.filter(i => i.x >= left && i.x <= right && i.y >= top && i.y <= bottom).map(i => i.id);
            if(inRange.length > 0) setSelectedIds(inRange);
          }
          setDragStart(null); setDragEnd(null);
        }}>
          {currentItems.map((item) => (
            <Draggable key={item.id} position={{ x: item.x, y: item.y }} onStart={() => { if(!selectedIds.includes(item.id)) setSelectedIds([item.id]); }} onDrag={(e, data) => {
              const dx = data.x - item.x; const dy = data.y - item.y;
              updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
            }} disabled={!isAdmin}>
              <div style={{ position: "absolute", zIndex: selectedIds.includes(item.id) ? 100 : 10, cursor: isAdmin ? "move" : "default" }}>
                <div style={{ 
                  transform: `rotate(${item.rotation}deg)`, width: item.width, height: item.height, 
                  backgroundColor: item.color, opacity: item.opacity,
                  border: selectedIds.includes(item.id) ? "2px solid #2563eb" : item.type === "wall" ? "none" : "1px solid #ddd",
                  borderRadius: item.type === "door" ? `${item.width}px ${item.width}px 0 0` : item.type === "seat" ? "4px" : "0", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: item.textColor, fontSize: "11px", fontWeight: "bold", textAlign: "center", overflow: "hidden"
                }}>
                  <span style={{opacity: item.textOpacity}}>{item.name}</span>
                </div>
              </div>
            </Draggable>
          ))}
          {dragStart && dragEnd && (
            <div style={{ position: "absolute", border: "1px solid #2563eb", backgroundColor: "rgba(37, 99, 235, 0.1)", left: Math.min(dragStart.x, dragEnd.x), top: Math.min(dragStart.y, dragEnd.y), width: Math.abs(dragEnd.x - dragStart.x), height: Math.abs(dragEnd.y - dragStart.y), pointerEvents: "none" }} />
          )}
        </div>
      </div>

      {/* 상세 편집 패널 */}
      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{fontSize: "14px", fontWeight: "bold", marginBottom: "15px"}}>항목 상세 설정</h2>
          {firstSelected ? (
            <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
              <div style={propCardS}><label style={labelS}>이름 / 텍스트</label>
                <input value={firstSelected.name} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, name: e.target.value} : i))} style={inputS} />
              </div>
              <div style={propCardS}><label style={labelS}>크기 수정 (W / H)</label>
                <div style={{display: "flex", gap: "5px"}}>
                  <input type="number" value={firstSelected.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, width: +e.target.value} : i))} style={inputS} />
                  <input type="number" value={firstSelected.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, height: +e.target.value} : i))} style={inputS} />
                </div>
              </div>
              <div style={propCardS}><label style={labelS}>배경 색상 및 투명도</label>
                <div style={paletteS}>
                  {palette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i))} style={{...paletteItemS, backgroundColor: c, border: firstSelected.color === c ? "2px solid #000" : "1px solid #ddd"}} />)}
                  <input type="color" value={firstSelected.color} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: e.target.value} : i))} style={colorPickerS} />
                </div>
                <input type="range" min="0" max="1" step="0.1" value={firstSelected.opacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, opacity: +e.target.value} : i))} style={{width: "100%", marginTop: "10px"}} />
              </div>
              <div style={propCardS}><label style={labelS}>글자 색상 및 투명도 (개별)</label>
                <input type="color" value={firstSelected.textColor} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, textColor: e.target.value} : i))} style={{width: "100%", height: "25px", border: "1px solid #ddd", marginBottom: "10px"}} />
                <input type="range" min="0" max="1" step="0.1" value={firstSelected.textOpacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, textOpacity: +e.target.value} : i))} style={{width: "100%"}} />
              </div>
              <div style={propCardS}><label style={labelS}>회전 및 복제</label>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px"}}>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 90) % 360} : i))} style={utilBtnS}>90° 회전</button>
                  <button onClick={copySelected} style={{...utilBtnS, backgroundColor: "#f0fdf4"}}>복제</button>
                </div>
              </div>
              <button onClick={() => { setModalMsg("삭제하시겠습니까?"); setModalType("confirm"); }} style={deleteBtnS}>선택 삭제</button>
            </div>
          ) : <p style={{color: "#94a3b8", fontSize: "11px", textAlign: "center", marginTop: "50px"}}>항목을 선택해주세요.</p>}
          <button onClick={() => setModalType("changePw")} style={pwBtnS}>관리자 비밀번호 변경</button>
        </div>
      )}
    </main>
  );
}

// 스타일 모음
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f1f5f9", overflow: "hidden" };
const sidebarS: any = { width: "260px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "260px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "20px", overflowY: "auto" };
const canvasS: any = { width: "100%", height: "100%", borderRadius: "12px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "30px", borderRadius: "20px", width: "340px", boxSizing: "border-box" };
const modalInputS: any = { width: "100%", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", marginBottom: "15px", boxSizing: "border-box", textAlign: "center" };
const eyedropperS: any = { width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #333", marginLeft: "5px" };
const adminBtnS: any = (adm: boolean) => ({ padding: "12px 20px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" });
const subBtnS: any = { padding: "12px 20px", border: "1px solid #e2e8f0", borderRadius: "10px", backgroundColor: "#fff", cursor: "pointer" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "12px", backgroundColor: bg, color: co, border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });
const floorBtnS: any = (act: boolean) => ({ padding: "8px 12px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" });
const floorDelBtnS: any = { backgroundColor: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px", cursor: "pointer", padding: "0 8px", fontWeight: "bold" };
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "12px", marginBottom: "20px", border: "1px solid #e2e8f0" };
const teamRowS: any = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", padding: "4px", borderRadius: "4px" };
const teamInputS: any = { border: "none", borderBottom: "1px solid #ddd", fontSize: "11px", backgroundColor: "transparent", width: "80px" };
const paletteS: any = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px" };
const paletteItemS: any = { height: "24px", borderRadius: "4px", cursor: "pointer" };
const colorPickerS: any = { width: "100%", height: "24px", padding: "0", border: "none", cursor: "pointer", gridColumn: "span 2" };
const propCardS: any = { padding: "12px", border: "1px solid #f1f5f9", borderRadius: "10px", backgroundColor: "#fff", marginBottom: "10px" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "6px", display: "block" };
const inputS: any = { width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box" };
const utilBtnS: any = { padding: "10px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" };
const deleteBtnS: any = { width: "100%", padding: "12px", backgroundColor: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" };
const titleEditS: any = { fontSize: "16px", fontWeight: "bold", border: "2px solid #2563eb", borderRadius: "8px", width: "100%", marginBottom: "20px", padding: "8px", boxSizing: "border-box" };
const addFloorBtnS: any = { width: "100%", padding: "8px", border: "1px dashed #cbd5e1", background: "none", borderRadius: "8px", color: "#64748b", cursor: "pointer", fontSize: "11px", marginTop: "8px" };
const pwBtnS: any = { background: "none", border: "none", color: "#cbd5e1", fontSize: "10px", cursor: "pointer", textDecoration: "underline", marginTop: "20px", textAlign: "center", width: "100%" };
