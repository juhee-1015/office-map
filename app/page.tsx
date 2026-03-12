"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

// --- 1. 타입 정의 ---
type ItemType = "seat" | "wall" | "door";

interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; width: number; height: number; x: number; y: number;
}

interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");
  const [modalType, setModalType] = useState<"login" | "changePw" | "error" | null>(null);
  const [modalInput, setModalInput] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#64748b", "#78350f"]);

  // Hydration 에러(서버-클라이언트 불일치) 방지
  useEffect(() => { setHasMounted(true); }, []);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;

  // 인원 통계 로직
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

  // 모달 확인 로직
  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); setModalInput(""); }
      else { setModalType("error"); setModalInput(""); }
    } else if (modalType === "changePw") {
      if (modalInput.trim()) { setAdminPassword(modalInput); setModalType(null); setModalInput(""); alert("비밀번호가 변경되었습니다."); }
    } else if (modalType === "error") { setModalType("login"); }
  };

  // 드래그 핸들러 (다중 선택 대응)
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

  const selectedItem = currentItems.find(i => i.id === selectedIds[0]);

  if (!hasMounted) return null;

  return (
    <main translate="no" className="notranslate" style={mainContainerS}>
      {/* --- 모달 레이어 --- */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "15px", fontWeight: "bold" }}>
              {modalType === "login" ? "관리자 인증" : modalType === "changePw" ? "비밀번호 설정" : "인증 실패"}
            </h3>
            {modalType === "error" ? (
              <p style={{ color: "red", marginBottom: "15px" }}>비밀번호가 틀렸습니다.</p>
            ) : (
              <input 
                type="password" 
                value={modalInput} 
                onChange={(e) => setModalInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} 
                style={inputS} 
                autoFocus 
              />
            )}
            <div style={{ display: "flex", gap: "5px", marginTop: "15px" }}>
              <button onClick={handleModalConfirm} style={adminBtnS(true)}>확인</button>
              <button onClick={() => setModalType(null)} style={subBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* --- 왼쪽 사이드바 --- */}
      <div style={sidebarS}>
        {isAdmin ? (
          <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} />
        ) : (
          <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "20px" }}>{appTitle}</h2>
        )}
        
        {isAdmin && (
          <div style={statsCardS}>
            <label style={labelS}>실시간 인원 (부서 클릭 시 그룹 선택)</label>
            <div style={{ fontWeight: "bold", color: "#2563eb", marginBottom: "8px" }}>총 {stats.total}석</div>
            {Object.entries(stats.teams).map(([color, count]: any) => (
              <div 
                key={color} 
                onClick={() => setSelectedIds(currentItems.filter(i => i.color === color).map(i => i.id))} 
                style={groupRowS}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px" }} />
                  <span>{teamNames[color] || "미지정 부서"}</span>
                </div>
                <span>{count}명</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label style={labelS}>{isAdmin ? "층 관리 (이름 수정 가능)" : "층 선택"}</label>
          {floors.map(f => (
            <div key={f.id} style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              <button 
                onClick={() => { setActiveFloorId(f.id); setSelectedIds([]); }} 
                style={floorBtnS(activeFloorId === f.id)}
              >
                {f.displayName}
              </button>
              {isAdmin && (
                <input 
                  value={f.displayName} 
                  onChange={(e) => setFloors(floors.map(it => it.id === f.id ? { ...it, displayName: e.target.value } : it))} 
                  style={floorInputS} 
                />
              )}
            </div>
          ))}
          {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: "새로운 층", items: [] }])} style={addFloorBtnS}>+ 새로운 층 추가</button>}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {isAdmin && <button onClick={() => setModalType("changePw")} style={pwBtnS}>비밀번호 변경</button>}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>
            {isAdmin ? "편집 종료" : "관리자 로그인"}
          </button>
          {isAdmin && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
              <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"seat", name:"좌석", rotation:0, color:"#3b82f6", width:45, height:45, x:50, y:50}]); setSelectedIds([id]); }} style={actionBtnS("#eff6ff", "#2563eb")}>좌석 추가</button>
              <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"door", name:"", rotation:0, color:"#94a3b8", width:50, height:50, x:60, y:60}]); setSelectedIds([id]); }} style={actionBtnS("#ecfdf5", "#10b981")}>문 추가</button>
              <button onClick={() => { const id=Date.now(); updateItems([...currentItems, {id, type:"wall", name:"", rotation:0, color:"#333", width:120, height:6, x:70, y:70}]); setSelectedIds([id]); }} style={{...actionBtnS("#f8fafc", "#1e293b"), gridColumn: "span 2"}}>벽체 추가</button>
            </div>
          )}
        </div>
      </div>

      {/* --- 중앙 도면 영역 --- */}
      <div style={{ flex: 1, padding: "20px" }}>
        <div style={canvasS} onMouseDown={(e) => { if(e.target === e.currentTarget) setSelectedIds([]); }}>
          {/* 모눈종이 점: 관리자 모드에서만 보임 */}
          <div style={{ ...gridOverlayS, display: isAdmin ? "block" : "none" }} />
          
          {currentItems.map((item) => (
            <DraggableComponent 
              key={item.id} 
              item={item} 
              isSelected={selectedIds.includes(item.id)} 
              isAdmin={isAdmin} 
              onSelect={() => { if(!selectedIds.includes(item.id)) setSelectedIds([item.id]); }} 
              onDrag={(data:any) => handleDrag(item.id, data)} 
            />
          ))}
        </div>
      </div>

      {/* --- 오른쪽 상세 설정 (관리자 전용) --- */}
      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "15px" }}>상세 설정</h2>
          {selectedItem ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={propCardS}>
                <label style={labelS}>부서 및 색상 (스포이드)</label>
                <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
                  <input type="color" value={selectedItem.color} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, color: e.target.value } : i))} style={{ flex: 1, height: "30px", cursor: "pointer", border: "none" }} />
                  <button onClick={() => setCustomPalette([...customPalette, selectedItem.color])} style={smallBtnS}>추가</button>
                </div>
                <input value={teamNames[selectedItem.color] || ""} onChange={(e) => setTeamNames({...teamNames, [selectedItem.color]: e.target.value})} style={inputS} placeholder="부서 이름 입력" />
                <div style={paletteS}>
                  {customPalette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, color: c } : i))} style={{...paletteItemS, backgroundColor: c, border: selectedItem.color === c ? "2px solid black" : "1px solid #ddd"}} />)}
                </div>
              </div>

              <div style={propCardS}>
                <label style={labelS}>정렬 및 회전 도구</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                  <button onClick={() => { const first = currentItems.find(i => i.id === selectedIds[0]); if(first) updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: first.x } : i)); }} style={toolBtn}>세로 정렬</button>
                  <button onClick={() => { const first = currentItems.find(i => i.id === selectedIds[0]); if(first) updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, y: first.y } : i)); }} style={toolBtn}>가로 정렬</button>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: (i.rotation + 90) % 360 } : i))} style={toolBtn}>90도 회전</button>
                  <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: (i.rotation + 180) % 360 } : i))} style={toolBtn}>180도 회전</button>
                </div>
                <button onClick={() => { const clones = currentItems.filter(i => selectedIds.includes(i.id)).map(i => ({ ...i, id: Date.now()+Math.random(), x: i.x+20, y: i.y+20 })); updateItems([...currentItems, ...clones]); }} style={{...toolBtn, width: "100%", marginTop: "5px", backgroundColor: "#f8fafc"}}>아이템 복제</button>
              </div>

              <div style={propCardS}>
                <label style={labelS}>이름 및 크기</label>
                <input value={selectedItem.name} onChange={(e) => updateItems(currentItems.map(i => i.id === selectedItem.id ? { ...i, name: e.target.value } : i))} style={{...inputS, marginBottom: "8px"}} />
                <div style={{ display: "flex", gap: "5px" }}>
                  <div style={{flex:1}}><span style={{fontSize:"10px", color:"#94a3b8"}}>W</span><input type="number" value={selectedItem.width} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, width: +e.target.value } : i))} style={inputS} /></div>
                  <div style={{flex:1}}><span style={{fontSize:"10px", color:"#94a3b8"}}>H</span><input type="number" value={selectedItem.height} onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, height: +e.target.value } : i))} style={inputS} /></div>
                </div>
              </div>
              <button onClick={() => { updateItems(currentItems.filter(i => !selectedIds.includes(i.id))); setSelectedIds([]); }} style={deleteBtnS}>선택 항목 삭제</button>
            </div>
          ) : <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "50px" }}>아이템을 선택하면<br/>설정이 나타납니다.</div>}
        </div>
      )}
    </main>
  );
}

// --- 2. 개별 아이템 컴포넌트 ---
function DraggableComponent({ item, isSelected, isAdmin, onSelect, onDrag }: any) {
  const nodeRef = useRef(null);
  
  // ✅ 도면 스타일 문 디자인 구현
  const renderDoor = () => (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* L자형 문틀 (회색) */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "2px", backgroundColor: "#94a3b8" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "2px", height: "100%", backgroundColor: "#94a3b8" }} />
      {/* 문이 열리는 방향 (부채꼴 점선) */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%", border: "1px dashed #cbd5e1", borderRadius: "0 100% 0 0" }} />
    </div>
  );

  return (
    <Draggable 
      nodeRef={nodeRef} 
      position={{ x: item.x, y: item.y }} 
      onStart={(e) => { e.stopPropagation(); onSelect(); }} 
      onDrag={(e, data) => onDrag(data)} 
      disabled={!isAdmin}
    >
      <div ref={nodeRef} style={{ position: "absolute", zIndex: isSelected ? 100 : 10 }}>
        <div style={{ 
          width: item.width, height: item.height, 
          // ✅ 문 타입일 때는 정사각형 배경색 제거
          backgroundColor: item.type === "door" ? "transparent" : item.color, 
          border: isSelected ? "2px solid #2563eb" : (item.type === "wall" ? "none" : "1px solid rgba(0,0,0,0.1)"), 
          // ✅ 문 타입일 때는 테두리 제거 (디자인 요소로 대체)
          ...(item.type === "door" && { border: "none" }),
          borderRadius: item.type === "seat" ? "6px" : "0", 
          transform: `rotate(${item.rotation}deg)`,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {item.type === "seat" && <span style={{ fontSize: "10px", color: "#fff", fontWeight: "bold", pointerEvents: "none" }}>{item.name}</span>}
          {item.type === "door" && renderDoor()}
        </div>
      </div>
    </Draggable>
  );
}

// --- 3. 스타일 정의 ---
const mainContainerS = { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "sans-serif", fontSize: "13px" };
const sidebarS = { width: "240px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" as const };
const rightPanelS = { width: "260px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "20px", overflowY: "auto" as const };
const canvasS = { width: "100%", height: "100%", backgroundColor: "#fff", borderRadius: "15px", border: "1px solid #e2e8f0", position: "relative" as const, overflow: "hidden" };
const inputS = { width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "12px", outline: "none" };
const labelS = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "5px", display: "block" };
const propCardS = { padding: "10px", border: "1px solid #f1f5f9", borderRadius: "8px", marginBottom: "10px" };
const toolBtn = { padding: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: "600" };
const adminBtnS = (adm: boolean) => ({ padding: "12px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", width: "100%", fontWeight: "bold" } as const);
const actionBtnS = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" } as const);
const floorBtnS = (act: boolean) => ({ flex: 1, padding: "8px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" } as const);
const floorInputS = { width: "65px", padding: "4px", border: "1px solid #e2e8f0", borderRadius: "5px", fontSize: "11px" };
const paletteS = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginTop: "8px" };
const paletteItemS = { height: "20px", borderRadius: "4px", cursor: "pointer" };
const statsCardS = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "20px" };
const groupRowS = { display: "flex", justifyContent: "space-between", padding: "6px", cursor: "pointer", borderRadius: "5px" };
const modalOverlayS = { position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContentS = { backgroundColor: "#fff", padding: "20px", borderRadius: "15px", width: "260px", textAlign: "center" as const };
const subBtnS = { padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", backgroundColor: "#fff", cursor: "pointer", width: "100%" };
const gridOverlayS = { position: "absolute" as const, inset: 0, backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" as const };
const titleEditS = { fontSize: "16px", fontWeight: "bold", padding: "6px", border: "1px solid #2563eb", borderRadius: "8px", marginBottom: "20px", width: "100%", outline: "none" };
const addFloorBtnS = { width: "100%", padding: "8px", border: "1px dashed #cbd5e1", background: "none", borderRadius: "8px", color: "#94a3b8", cursor: "pointer", fontSize: "11px" };
const smallBtnS = { padding: "0 10px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "5px", fontSize: "11px", cursor: "pointer" };
const pwBtnS = { padding: "6px", background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", color: "#64748b", fontSize: "11px", cursor: "pointer", marginBottom: "5px" };
const deleteBtnS = { width: "100%", padding: "12px", color: "red", border: "1px solid #fee2e2", borderRadius: "10px", cursor: "pointer", background: "none", fontWeight: "bold" };
