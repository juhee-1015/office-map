"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Draggable from "react-draggable";

type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }
interface SavedVersion { id: string; name: string; date: string; data: FloorInfo[]; }

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");

  // 모달 상태
  const [modalType, setModalType] = useState<"login" | "changePw" | "alert" | "confirm" | "saveVersion" | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMsg, setModalMsg] = useState("");
  
  // 데이터 상태
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [customPalette, setCustomPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#64748b", "#78350f"]);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);

  // --- 데이터 계산 (에러 방지를 위해 핸들러보다 먼저 선언) ---
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

  // --- 핸들러 로직 ---
  const requestDelete = () => {
    if (selectedIds.length === 0) return;
    setModalMsg(`선택한 ${selectedIds.length}개 항목을 삭제하시겠습니까?`);
    setModalType("confirm");
  };

  const saveCurrentVersion = () => {
    if (!modalInput.trim()) return;
    const newVer: SavedVersion = {
      id: `V-${Date.now()}`,
      name: modalInput,
      date: new Date().toLocaleString(),
      data: JSON.parse(JSON.stringify(floors))
    };
    setSavedVersions([newVer, ...savedVersions]);
    setModalType("alert");
    setModalMsg(`'${modalInput}' 버전이 저장되었습니다.`);
    setModalInput("");
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
    } else { setModalType(null); }
  };

  if (!hasMounted) return null;

  const selectedItem = currentItems.find(i => i.id === selectedIds[0]);

  return (
    <main style={mainContainerS}>
      {/* 커스텀 모달 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "bold" }}>
              {modalType === "login" ? "관리자 인증" : modalType === "saveVersion" ? "버전 이름 지정" : "알림"}
            </h3>
            <div style={{ padding: "0 25px" }}>
              {(modalType === "login" || modalType === "changePw" || modalType === "saveVersion") && (
                <input 
                  value={modalInput} 
                  onChange={(e) => setModalInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()} 
                  style={modalInputS} 
                  placeholder={modalType === "saveVersion" ? "예: 3월 정기 이동" : "내용 입력"}
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

      {/* 왼쪽 사이드바 */}
      <div style={sidebarS}>
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "15px" }}>{appTitle}</h2>}
        
        {isAdmin && (
          <>
            <div style={statsCardS}>
              <div style={{ fontWeight: "800", fontSize: "17px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", marginBottom: "10px" }}>총 {stats.total}석</div>
              <div style={{maxHeight: "150px", overflowY: "auto"}}>
                {Object.entries(stats.teams).map(([color, count]: any) => (
                  <div key={color} style={groupRowS} onClick={() => setSelectedIds(currentItems.filter(i => i.color === color).map(i => i.id))}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px" }} /><span>{teamNames[color] || "미지정"}</span></div>
                    <span style={{ fontWeight: "bold" }}>{count}석</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelS}>히스토리</label>
              <div style={versionListS}>
                {savedVersions.map(v => (
                  <div key={v.id} onClick={() => setFloors(v.data)} style={versionItemS}>
                    <div style={{fontWeight: "bold"}}>{v.name}</div>
                    <div style={{fontSize: "10px", color: "#94a3b8"}}>{v.date}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setModalType("saveVersion")} style={saveVerBtnS}>현재 배치 저장</button>
            </div>
          </>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label style={labelS}>층 관리</label>
          {floors.map(f => (
            <div key={f.id} style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
              <button onClick={() => setActiveFloorId(f.id)} style={floorBtnS(activeFloorId === f.id)}>{f.displayName}</button>
              {isAdmin && <input value={f.displayName} onChange={(e) => setFloors(floors.map(it => it.id === f.id ? { ...it, displayName: e.target.value } : it))} style={floorInputS} />}
            </div>
          ))}
          {isAdmin && <button onClick={() => setFloors([...floors, { id: `F${Date.now()}`, displayName: `${floors.length+1}층`, items: [] }])} style={addFloorBtnS}>+ 층 추가</button>}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {isAdmin && <button onClick={() => setModalType("changePw")} style={pwBtnS}>비밀번호 변경</button>}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 중앙 캔버스 */}
      <div style={{ flex: 1, padding: "20px" }}>
        <div ref={canvasRef} style={canvasS} onMouseDown={(e) => { if(!isAdmin || e.target !== canvasRef.current) return; setSelectedIds([]); }}>
          {currentItems.map((item) => (
            <DraggableComponent key={item.id} item={item} isSelected={selectedIds.includes(item.id)} isAdmin={isAdmin} onSelect={() => setSelectedIds([item.id])} onDrag={(data:any) => updateItems(currentItems.map(i => i.id === item.id ? { ...i, x: data.x, y: data.y } : i))} />
          ))}
        </div>
      </div>

      {/* 오른쪽 관리 도구 (복구됨) */}
      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "15px" }}>상세 설정</h2>
          {selectedItem ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={propCardS}>
                <label style={labelS}>이름 및 크기</label>
                <input value={selectedItem.name} onChange={(e) => updateItems(currentItems.map(i => i.id === selectedItem.id ? { ...i, name: e.target.value } : i))} style={inputS} />
                <div style={{ display: "flex", gap: "5px", marginTop: "8px" }}>
                  <input type="number" value={selectedItem.width} onChange={(e) => updateItems(currentItems.map(i => i.id === selectedItem.id ? { ...i, width: +e.target.value } : i))} style={inputS} />
                  <input type="number" value={selectedItem.height} onChange={(e) => updateItems(currentItems.map(i => i.id === selectedItem.id ? { ...i, height: +e.target.value } : i))} style={inputS} />
                </div>
              </div>
              <div style={propCardS}>
                <label style={labelS}>부서 지정</label>
                <input value={teamNames[selectedItem.color] || ""} onChange={(e) => setTeamNames({...teamNames, [selectedItem.color]: e.target.value})} style={inputS} placeholder="부서명" />
                <div style={paletteS}>
                  {customPalette.map(c => <div key={c} onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, color: c } : i))} style={{...paletteItemS, backgroundColor: c, border: selectedItem.color === c ? "2px solid #000" : "1px solid #ddd"}} />)}
                </div>
              </div>
              <button onClick={requestDelete} style={deleteBtnS}>선택 항목 삭제</button>
            </div>
          ) : <p style={{color: "#94a3b8", textAlign: "center", marginTop: "40px"}}>선택된 항목이 없습니다.</p>}
        </div>
      )}
    </main>
  );
}

// Draggable 컴포넌트
function DraggableComponent({ item, isSelected, isAdmin, onSelect, onDrag }: any) {
  const nodeRef = useRef(null);
  return (
    <Draggable nodeRef={nodeRef} position={{ x: item.x, y: item.y }} onStart={onSelect} onDrag={(e, data) => onDrag(data)} disabled={!isAdmin}>
      <div ref={nodeRef} style={{ position: "absolute", zIndex: isSelected ? 100 : 10 }}>
        <div style={{ width: item.width, height: item.height, backgroundColor: item.color, border: isSelected ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.1)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: "10px" }}>
          {item.name}
        </div>
      </div>
    </Draggable>
  );
}

// 스타일 (오타 및 누락 복구)
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "sans-serif" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column", zIndex: 100 };
const rightPanelS: any = { width: "260px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "20px", zIndex: 100 };
const canvasS: any = { width: "100%", height: "100%", backgroundColor: "#fff", borderRadius: "15px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "30px 0", borderRadius: "20px", width: "320px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const modalInputS: any = { width: "80%", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", outline: "none" };
const inputS: any = { width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", boxSizing: "border-box" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "5px", display: "block" };
const propCardS: any = { padding: "12px", border: "1px solid #f1f5f9", borderRadius: "10px", marginBottom: "10px" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer", width: "100%" };
const floorBtnS: any = (act: boolean) => ({ flex: 1, padding: "8px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" });
const floorInputS: any = { width: "60px", padding: "4px", border: "1px solid #e2e8f0", borderRadius: "4px" };
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "15px" };
const groupRowS: any = { display: "flex", justifyContent: "space-between", padding: "5px 0", cursor: "pointer", fontSize: "12px" };
const versionListS: any = { maxHeight: "100px", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "8px", padding: "5px", marginBottom: "5px" };
const versionItemS: any = { padding: "8px", borderBottom: "1px solid #f8fafc", cursor: "pointer", fontSize: "11px" };
const saveVerBtnS: any = { width: "100%", padding: "6px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "11px", cursor: "pointer" };
const titleEditS: any = { fontSize: "16px", fontWeight: "bold", padding: "5px", border: "1px solid #2563eb", borderRadius: "6px", width: "100%", marginBottom: "15px" };
const addFloorBtnS: any = { width: "100%", padding: "6px", border: "1px dashed #cbd5e1", background: "none", borderRadius: "6px", color: "#94a3b8", cursor: "pointer", fontSize: "11px", marginTop: "5px" };
const pwBtnS: any = { background: "none", border: "none", color: "#94a3b8", fontSize: "10px", cursor: "pointer", textDecoration: "underline", marginBottom: "5px" };
const paletteS: any = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginTop: "10px" };
const paletteItemS: any = { height: "20px", borderRadius: "4px", cursor: "pointer" };
const deleteBtnS: any = { width: "100%", padding: "10px", color: "#ef4444", border: "1px solid #fee2e2", borderRadius: "8px", cursor: "pointer", backgroundColor: "#fff", fontWeight: "bold", marginTop: "10px" };
