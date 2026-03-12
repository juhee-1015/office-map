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
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#64748b", "#333333"]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => { setHasMounted(true); }, []);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItems = useMemo(() => currentItems.filter(i => selectedIds.includes(i.id)), [currentItems, selectedIds]);
  const firstSelected = selectedItems[0];

  const stats = useMemo(() => {
    const allSeats = floors.reduce((acc, f) => acc + f.items.filter(i => i.type === "seat").length, 0);
    const floorSeats = currentItems.filter(i => i.type === "seat");
    const counts = floorSeats.reduce((acc: any, cur) => {
      acc[cur.color] = (acc[cur.color] || 0) + 1;
      return acc;
    }, {});
    return { totalAll: allSeats, totalFloor: floorSeats.length, counts };
  }, [floors, currentItems]);

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

  const alignObjects = (type: 'horizontal' | 'vertical') => {
    if (selectedItems.length < 2) return;
    if (type === 'horizontal') {
      const avgY = selectedItems.reduce((acc, cur) => acc + cur.y, 0) / selectedItems.length;
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, y: avgY } : i));
    } else {
      const avgX = selectedItems.reduce((acc, cur) => acc + cur.x, 0) / selectedItems.length;
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: avgX } : i));
    }
  };

  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); }
      else { setModalMsg("비밀번호가 틀렸습니다."); setModalType("alert"); }
    } else if (modalType === "changePw") {
      setAdminPassword(modalInput); setModalType(null);
    } else if (modalType === "saveVersion") {
      setSavedVersions([{ id: `V-${Date.now()}`, name: modalInput || "새 버전", date: new Date().toLocaleString(), data: JSON.parse(JSON.stringify(floors)) }, ...savedVersions]);
      setModalType(null);
    }
    setModalInput("");
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {/* 모달 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{marginBottom: "15px", fontWeight: "bold"}}>{modalType === "changePw" ? "비밀번호 설정" : modalType === "saveVersion" ? "버전 저장" : "알림"}</h3>
            <input type={(modalType === "login" || modalType === "changePw") ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} style={modalInputS} autoFocus placeholder="내용 입력..." />
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
          <label style={labelS}>층 관리</label>
          <div style={{display: "flex", flexDirection: "column", gap: "5px"}}>
            {floors.map((f, idx) => (
              <div key={f.id} style={{display: "flex", gap: "2px", alignItems: "center"}}>
                <button onClick={() => setActiveFloorId(f.id)} style={{...floorBtnS(activeFloorId === f.id), flex: 1}}>{f.displayName}</button>
                {isAdmin && (
                  <div style={{display: "flex", gap: "2px"}}>
                    <button onClick={() => {
                        const newFloors = [...floors];
                        if (idx > 0) { [newFloors[idx], newFloors[idx-1]] = [newFloors[idx-1], newFloors[idx]]; setFloors(newFloors); }
                    }} style={moveBtnS}>▲</button>
                    <button onClick={() => {
                        const newFloors = [...floors];
                        if (idx < floors.length - 1) { [newFloors[idx], newFloors[idx+1]] = [newFloors[idx+1], newFloors[idx]]; setFloors(newFloors); }
                    }} style={moveBtnS}>▼</button>
                    <button onClick={() => {
                        if (floors.length > 1 && confirm("층을 삭제하시겠습니까?")) {
                            const nf = floors.filter(it => it.id !== f.id);
                            setFloors(nf); if(activeFloorId === f.id) setActiveFloorId(nf[0].id);
                        }
                    }} style={floorDelBtnS}>×</button>
                  </div>
                )}
              </div>
            ))}
            {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: `${floors.length + 1}층`, items: [] }])} style={addFloorBtnS}>+ 층 추가</button>}
          </div>
        </div>

        {isAdmin && (
          <div style={statsCardS}>
            <div style={{fontWeight: "bold", fontSize: "12px", marginBottom: "5px"}}>📊 좌석 통계</div>
            <div style={{fontSize: "11px", color: "#64748b", marginBottom: "10px"}}>전체: {stats.totalAll}석 / 현재: {stats.totalFloor}석</div>
            {Object.entries(stats.counts).map(([color, count]: any) => (
              <div key={color} style={{...teamRowS, cursor: 'pointer'}} onClick={() => setSelectedIds(currentItems.filter(i => i.color === color).map(i => i.id))}>
                <div style={{display: "flex", alignItems: "center", gap: "5px"}}>
                  <div style={{width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px"}} />
                  <input value={teamNames[color] || ""} placeholder="부서명" onChange={(e) => setTeamNames({...teamNames, [color]: e.target.value})} style={teamInputS} onClick={(e) => e.stopPropagation()} />
                </div>
                <b style={{fontSize: "10px"}}>{count}석</b>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <>
              <button onClick={() => setModalType("saveVersion")} style={subBtnS}>현재 버전 저장 (히스토리)</button>
              <div style={historyBoxS}>
                {savedVersions.map(v => (
                  <div key={v.id} onClick={() => { if(confirm(`${v.name} 버전으로 복구할까요?`)) setFloors(v.data); }} style={historyItemS}>{v.name} ({v.date.split(' ')[1]})</div>
                ))}
              </div>
              <button onClick={() => addItem("seat")} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <div style={{display: "flex", gap: "5px"}}>
                <button onClick={() => addItem("wall")} style={{...actionBtnS("#f8fafc", "#333"), flex: 1}}>벽체 추가</button>
                <button onClick={() => addItem("door")} style={{...actionBtnS("#ecfdf5", "#10b981"), flex: 1}}>문 추가</button>
              </div>
            </>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 캔버스 */}
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
        }} onMouseUp={() => { setDragStart(null); setDragEnd(null); }}>
          {currentItems.map((item) => (
            <Draggable key={item.id} position={{ x: item.x, y: item.y }} onStart={() => !selectedIds.includes(item.id) && setSelectedIds([item.id])} onDrag={(e, data) => {
              const dx = data.x - item.x; const dy = data.y - item.y;
              updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
            }} disabled={!isAdmin}>
              <div style={{ position: "absolute", zIndex: selectedIds.includes(item.id) ? 100 : 10 }}>
                <div style={{ 
                  transform: `rotate(${item.rotation}deg)`, width: item.width, height: item.height, 
                  backgroundColor: item.color, opacity: item.opacity, // 배경 투명도
                  border: selectedIds.includes(item.id) ? "2px solid #2563eb" : "1px solid #ddd",
                  borderRadius: item.type === "door" ? `${item.width}px ${item.width}px 0 0` : "4px", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: item.textColor, fontSize: "11px", fontWeight: "bold"
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

      {/* 상세 설정 패널 */}
      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{fontSize: "14px", fontWeight: "bold", marginBottom: "15px"}}>항목 설정</h2>
          {firstSelected ? (
            <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
              <div style={propCardS}><label style={labelS}>이름</label>
                <input value={firstSelected.name} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, name: e.target.value} : i))} style={inputS} />
              </div>

              <div style={propCardS}><label style={labelS}>크기 (W / H)</label>
                <div style={{display: "flex", gap: "5px"}}>
                  <input type="number" value={firstSelected.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, width: +e.target.value} : i))} style={inputS} />
                  <input type="number" value={firstSelected.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, height: +e.target.value} : i))} style={inputS} />
                </div>
              </div>

              <div style={propCardS}><label style={labelS}>배경색 및 투명도</label>
                <div style={paletteS}>
                  {customPalette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i))} style={{...paletteItemS, backgroundColor: c, border: firstSelected.color === c ? "2px solid #000" : "1px solid #ddd"}} />)}
                  <input type="color" value={firstSelected.color} onChange={(e) => {
                    const c = e.target.value;
                    if(!customPalette.includes(c)) setCustomPalette([c, ...customPalette.slice(0, 14)]);
                    updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, color: c} : i));
                  }} style={colorPickerS} />
                </div>
                <input type="range" min="0" max="1" step="0.1" value={firstSelected.opacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, opacity: +e.target.value} : i))} style={{width: "100%", marginTop: "10px"}} />
              </div>

              <div style={propCardS}><label style={labelS}>글자색 및 투명도</label>
                <input type="color" value={firstSelected.textColor} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, textColor: e.target.value} : i))} style={{width: "100%", height: "25px", border: "1px solid #ddd", marginBottom: "5px"}} />
                <input type="range" min="0" max="1" step="0.1" value={firstSelected.textOpacity} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, textOpacity: +e.target.value} : i))} style={{width: "100%"}} />
              </div>

              <div style={propCardS}><label style={labelS}>회전 / 정렬 / 복제</label>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px"}}>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 90) % 360} : i))} style={utilBtnS}>90°</button>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? {...i, rotation: (i.rotation + 180) % 360} : i))} style={utilBtnS}>180°</button>
                  <button onClick={() => alignObjects('horizontal')} style={utilBtnS}>가로정렬</button>
                  <button onClick={() => alignObjects('vertical')} style={utilBtnS}>세로정렬</button>
                </div>
                <button onClick={copySelected} style={{...utilBtnS, width: "100%", backgroundColor: "#f0fdf4", color: "#16a34a"}}>선택 항목 복제</button>
              </div>
              <button onClick={() => updateItems(currentItems.filter(i => !selectedIds.includes(i.id)))} style={deleteBtnS}>삭제</button>
              <button onClick={() => setModalType("changePw")} style={{...subBtnS, fontSize: "10px", marginTop: "10px"}}>비번 변경</button>
            </div>
          ) : <p style={{color: "#94a3b8", fontSize: "11px", textAlign: "center", marginTop: "50px"}}>항목을 선택하세요.</p>}
        </div>
      )}
    </main>
  );
}

// 스타일
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f1f5f9", overflow: "hidden" };
const sidebarS: any = { width: "250px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "15px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "250px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "15px", overflowY: "auto" };
const canvasS: any = { width: "100%", height: "100%", borderRadius: "12px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden", backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "20px 20px" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "25px", borderRadius: "15px", width: "300px", boxSizing: "border-box", textAlign: "center" };
const modalInputS: any = { width: "100%", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "8px", boxSizing: "border-box" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" });
const subBtnS: any = { padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer", fontSize: "11px" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "11px" });
const floorBtnS: any = (act: boolean) => ({ padding: "8px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", textAlign: "left" });
const moveBtnS: any = { padding: "4px 6px", fontSize: "10px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff", cursor: "pointer" };
const floorDelBtnS: any = { padding: "4px 8px", fontSize: "12px", border: "none", borderRadius: "4px", backgroundColor: "#fee2e2", color: "#ef4444", cursor: "pointer" };
const addFloorBtnS: any = { width: "100%", padding: "8px", border: "1px dashed #cbd5e1", background: "none", borderRadius: "8px", color: "#64748b", cursor: "pointer", fontSize: "11px", marginTop: "5px" };
const statsCardS: any = { padding: "10px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "15px", border: "1px solid #e2e8f0" };
const teamRowS: any = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" };
const teamInputS: any = { border: "none", borderBottom: "1px solid #ddd", fontSize: "10px", backgroundColor: "transparent", width: "70px" };
const historyBoxS: any = { maxHeight: "80px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px", padding: "5px", marginBottom: "10px", fontSize: "10px" };
const historyItemS: any = { padding: "4px", borderBottom: "1px solid #f9f9f9", cursor: "pointer" };
const paletteS: any = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" };
const paletteItemS: any = { height: "20px", borderRadius: "3px", cursor: "pointer" };
const colorPickerS: any = { width: "100%", height: "20px", padding: "0", border: "none", cursor: "pointer", gridColumn: "span 2" };
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", backgroundColor: "#fff", marginBottom: "8px" };
const labelS: any = { fontSize: "10px", color: "#94a3b8", fontWeight: "bold", marginBottom: "5px", display: "block" };
const inputS: any = { width: "100%", padding: "6px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px", boxSizing: "border-box" };
const utilBtnS: any = { padding: "8px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "10px", cursor: "pointer" };
const deleteBtnS: any = { width: "100%", padding: "10px", backgroundColor: "#fff1f2", color: "#e11d48", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" };
const titleEditS: any = { fontSize: "14px", fontWeight: "bold", border: "2px solid #2563eb", borderRadius: "6px", width: "100%", marginBottom: "15px", padding: "8px", boxSizing: "border-box" };
