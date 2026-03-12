"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

// --- 타입 정의 ---
type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");
  const [modalType, setModalType] = useState<"login" | "changePw" | "error" | null>(null);
  const [modalInput, setModalInput] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#64748b", "#78350f"]);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);

  // --- 키보드 삭제(Delete) 기능 추가 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAdmin || selectedIds.length === 0) return;
      // 입력창(input)에서 글자 지울 때는 작동 안하게 방어
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (confirm(`선택한 ${selectedIds.length}개 항목을 삭제하시겠습니까?`)) {
          updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
          setSelectedIds([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, selectedIds, activeFloorId, floors]);

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

  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); setModalInput(""); }
      else { setModalType("error"); setModalInput(""); }
    } else if (modalType === "changePw") {
      if (modalInput.trim()) { setAdminPassword(modalInput); setModalType(null); setModalInput(""); alert("비밀번호 변경 완료"); }
    } else if (modalType === "error") { setModalType("login"); }
  };

  // 영역 선택
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelectedIds([]);
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onCanvasMouseUp = () => {
    if (!dragStart || !dragEnd) { setDragStart(null); setDragEnd(null); return; }
    const x1 = Math.min(dragStart.x, dragEnd.x);
    const y1 = Math.min(dragStart.y, dragEnd.y);
    const x2 = Math.max(dragStart.x, dragEnd.x);
    const y2 = Math.max(dragStart.y, dragEnd.y);
    const newlySelected = currentItems.filter(item => 
      item.x >= x1 && item.x <= x2 && item.y >= y1 && item.y <= y2
    ).map(i => i.id);
    setSelectedIds(newlySelected);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleDrag = (id: number, data: { x: number, y: number }) => {
    const target = currentItems.find(i => i.id === id);
    if (!target) return;
    const dx = data.x - target.x;
    const dy = data.y - target.y;
    if (selectedIds.includes(id)) {
      updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
    } else {
      setSelectedIds([id]);
      updateItems(currentItems.map(i => i.id === id ? { ...i, x: data.x, y: data.y } : i));
    }
  };

  // 90도/180도 회전 로직 (안먹히던 문제 수정)
  const rotateItems = (deg: number) => {
    updateItems(currentItems.map(i => {
      if (selectedIds.includes(i.id)) {
        if (deg === 90) {
          // 가로세로를 실제로 맞바꿈
          return { ...i, width: i.height, height: i.width, rotation: (i.rotation + 90) % 360 };
        } else {
          // 180도는 각도만 회전
          return { ...i, rotation: (i.rotation + 180) % 360 };
        }
      }
      return i;
    }));
  };

  const selectedItem = currentItems.find(i => i.id === selectedIds[0]);
  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "15px" }}>{modalType === "login" ? "관리자 인증" : "비밀번호 설정"}</h3>
            <input type="password" value={modalInput} onChange={(e) => setModalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} style={inputS} autoFocus />
            <div style={{ display: "flex", gap: "5px", marginTop: "15px" }}>
              <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
              <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      <div style={sidebarS}>
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "20px" }}>{appTitle}</h2>}
        {isAdmin && (
          <div style={statsCardS}>
            <p style={{ fontSize: "11px", color: "#6366f1", marginBottom: "8px", fontWeight: "600" }}>💡 부서 색상 클릭 시 그룹 선택</p>
            <div style={{ fontWeight: "bold", color: "#2563eb", fontSize: "13px", marginBottom: "8px" }}>총 {stats.total}석</div>
            {Object.entries(stats.teams).map(([color, count]: any) => (
              <div key={color} onClick={() => setSelectedIds(currentItems.filter(i => i.color === color).map(i => i.id))} style={groupRowS}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px" }} /><span>{teamNames[color] || "미지정"}</span></div>
                <span>{count}명</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelS}>층 관리</label>
          {floors.map(f => (
            <div key={f.id} style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
              <button onClick={() => { setActiveFloorId(f.id); setSelectedIds([]); }} style={{...floorBtnS(activeFloorId === f.id), flex: 2}}>{f.displayName}</button>
              {isAdmin && <input value={f.displayName} onChange={(e) => setFloors(floors.map(it => it.id === f.id ? { ...it, displayName: e.target.value } : it))} style={{...floorInputS, flex: 1}} />}
            </div>
          ))}
          {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: `${floors.length+1}층`, items: [] }])} style={addFloorBtnS}>+ 층 추가</button>}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {isAdmin && <button onClick={() => setModalType("changePw")} style={pwBtnS}>비밀번호 변경</button>}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
          {isAdmin && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"seat", name:"좌석", rotation:0, color:"#3b82f6", width:45, height:45, x:50, y:50}]); setSelectedIds([id]); }} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"wall", name:"", rotation:0, color:"#333", width:120, height:6, x:70, y:70}]); setSelectedIds([id]); }} style={actionBtnS("#f8fafc", "#1e293b")}>벽체 추가</button>
                <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"door", name:"", rotation:0, color:"#94a3b8", width:50, height:50, x:60, y:60}]); setSelectedIds([id]); }} style={actionBtnS("#ecfdf5", "#10b981")}>문 추가</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: "20px" }}>
        <div ref={canvasRef} style={canvasS} onMouseDown={onCanvasMouseDown} onMouseMove={onCanvasMouseMove} onMouseUp={onCanvasMouseUp}>
          <div style={{ ...gridOverlayS, display: isAdmin ? "block" : "none" }} />
          {dragStart && dragEnd && (
            <div style={{ position: "absolute", zIndex: 999, border: "1px solid #2563eb", backgroundColor: "rgba(37, 99, 235, 0.1)", left: Math.min(dragStart.x, dragEnd.x), top: Math.min(dragStart.y, dragEnd.y), width: Math.abs(dragStart.x - dragEnd.x), height: Math.abs(dragStart.y - dragEnd.y), pointerEvents: "none" }} />
          )}
          {currentItems.map((item) => (
            <DraggableComponent key={item.id} item={item} isSelected={selectedIds.includes(item.id)} isAdmin={isAdmin} onSelect={() => { if(!selectedIds.includes(item.id)) setSelectedIds([item.id]); }} onDrag={(data:any) => handleDrag(item.id, data)} />
          ))}
        </div>
      </div>

      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "15px" }}>상세 설정</h2>
          {selectedItem ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={propCardS}>
                <label style={labelS}>부서 및 색상 (팔레트)</label>
                <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
                  <input type="color" value={selectedItem.color} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, color: e.target.value } : i))} style={{ flex: 1, height: "30px", border: "none", cursor: "pointer" }} />
                  <button onClick={() => setCustomPalette([...customPalette, selectedItem.color])} style={smallBtnS}>저장</button>
                </div>
                <input value={teamNames[selectedItem.color] || ""} onChange={(e) => setTeamNames({...teamNames, [selectedItem.color]: e.target.value})} style={inputS} placeholder="부서 이름 입력" />
                <div style={paletteS}>
                  {customPalette.map((c, idx) => <div key={idx} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, color: c } : i))} style={{...paletteItemS, backgroundColor: c, border: selectedItem.color === c ? "2px solid black" : "1px solid #ddd"}} />)}
                </div>
              </div>
              <div style={propCardS}>
                <label style={labelS}>배치 도구 (키보드 Del키로 삭제 가능)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                  <button onClick={() => rotateItems(90)} style={toolBtn}>90° 회전</button>
                  <button onClick={() => rotateItems(180)} style={toolBtn}>180° 회전</button>
                  <button onClick={() => { const first = currentItems.find(i => i.id === selectedIds[0]); if(first) updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: first.x } : i)); }} style={toolBtn}>세로 정렬</button>
                  <button onClick={() => { const first = currentItems.find(i => i.id === selectedIds[0]); if(first) updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, y: first.y } : i)); }} style={toolBtn}>가로 정렬</button>
                </div>
                <button onClick={() => { const clones = currentItems.filter(i => selectedIds.includes(i.id)).map(i => ({ ...i, id: Date.now()+Math.random(), x: i.x+20, y: i.y+20 })); updateItems([...currentItems, ...clones]); }} style={{...toolBtn, width: "100%", marginTop: "5px"}}>아이템 복제</button>
              </div>
              <div style={propCardS}>
                <label style={labelS}>이름 및 크기</label>
                <input value={selectedItem.name} onChange={(e) => updateItems(currentItems.map(i => i.id === selectedItem.id ? { ...i, name: e.target.value } : i))} style={{...inputS, marginBottom: "8px"}} />
                <div style={{ display: "flex", gap: "5px" }}>
                  <input type="number" value={selectedItem.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, width: +e.target.value } : i))} style={inputS} />
                  <input type="number" value={selectedItem.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, height: +e.target.value } : i))} style={inputS} />
                </div>
              </div>
              <button onClick={() => { if(confirm("삭제하시겠습니까?")) { updateItems(currentItems.filter(i => !selectedIds.includes(i.id))); setSelectedIds([]); } }} style={deleteBtnS}>항목 삭제</button>
            </div>
          ) : <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "50px" }}>아이템을 드래그하여<br/>선택해 보세요.</div>}
        </div>
      )}
    </main>
  );
}

function DraggableComponent({ item, isSelected, isAdmin, onSelect, onDrag }: any) {
  const nodeRef = useRef(null);
  const renderDoor = () => (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "2px", backgroundColor: "#94a3b8" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "2px", height: "100%", backgroundColor: "#94a3b8" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%", border: "1px dashed #cbd5e1", borderRadius: "0 100% 0 0" }} />
    </div>
  );

  return (
    <Draggable nodeRef={nodeRef} position={{ x: item.x, y: item.y }} onStart={(e) => { e.stopPropagation(); onSelect(); }} onDrag={(e, data) => onDrag(data)} disabled={!isAdmin}>
      <div ref={nodeRef} style={{ position: "absolute", zIndex: isSelected ? 100 : 10 }}>
        <div style={{ 
          width: item.width, height: item.height, backgroundColor: item.type === "door" ? "transparent" : item.color, 
          border: isSelected ? "2px solid #2563eb" : (item.type === "wall" ? "none" : "1px solid rgba(0,0,0,0.1)"), 
          ...(item.type === "door" && { border: "none" }), borderRadius: item.type === "seat" ? "4px" : "0", 
          transform: `rotate(${item.rotation}deg)`, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.1s"
        }}>
          {item.type === "seat" && (
            <span style={{ fontSize: "10px", color: "#fff", fontWeight: "bold", pointerEvents: "none" }}>{item.name}</span>
          )}
          {item.type === "door" && renderDoor()}
        </div>
      </div>
    </Draggable>
  );
}

// 스타일 시트
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "sans-serif", fontSize: "13px" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "260px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "20px", overflowY: "auto" };
const canvasS: any = { width: "100%", height: "100%", backgroundColor: "#fff", borderRadius: "15px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden", cursor: "crosshair" };
const inputS: any = { width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "12px", outline: "none" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "5px", display: "block" };
const propCardS: any = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", marginBottom: "10px" };
const toolBtn: any = { padding: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: "600" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontWeight: "bold" });
const actionBtnS: any = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" });
const floorBtnS: any = (act: boolean) => ({ padding: "8px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" });
const floorInputS: any = { padding: "4px", border: "1px solid #e2e8f0", borderRadius: "5px", fontSize: "11px" };
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "20px", border: "1px solid #eef2ff" };
const groupRowS: any = { display: "flex", justifyContent: "space-between", padding: "6px", cursor: "pointer", borderRadius: "5px" };
const paletteS: any = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginTop: "8px" };
const paletteItemS: any = { height: "20px", borderRadius: "4px", cursor: "pointer" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "20px", borderRadius: "15px", width: "260px", textAlign: "center" };
const subBtnS: any = { padding: "10px", border: "1px solid #e2e8f0", borderRadius: "10px", backgroundColor: "#fff", cursor: "pointer", width: "100%" };
const gridOverlayS: any = { position: "absolute", inset: 0, backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" };
const titleEditS: any = { fontSize: "16px", fontWeight: "bold", padding: "6px", border: "1px solid #2563eb", borderRadius: "8px", marginBottom: "20px", width: "100%", outline: "none" };
const addFloorBtnS: any = { width: "100%", padding: "6px", border: "1px dashed #cbd5e1", background: "none", borderRadius: "8px", color: "#94a3b8", cursor: "pointer", fontSize: "11px", marginTop: "5px" };
const smallBtnS: any = { padding: "0 10px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "5px", fontSize: "11px", cursor: "pointer" };
const pwBtnS: any = { padding: "4px", background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", color: "#64748b", fontSize: "10px", cursor: "pointer", marginBottom: "5px", alignSelf: "flex-end" };
const deleteBtnS: any = { width: "100%", padding: "10px", color: "red", border: "1px solid #fee2e2", borderRadius: "10px", cursor: "pointer", background: "none", fontWeight: "bold" };
