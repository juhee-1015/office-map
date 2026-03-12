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

  const [modalType, setModalType] = useState<"login" | "changePw" | "alert" | "confirm" | "saveVersion" | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMsg, setModalMsg] = useState("");
  
  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [teamNames, setTeamNames] = useState<{ [key: string]: string }>({});
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);

  useEffect(() => { setHasMounted(true); }, []);

  // --- 1. 데이터 계산부 (순서 에러 방지) ---
  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItem = useMemo(() => currentItems.find(i => i.id === selectedIds[0]), [currentItems, selectedIds]);

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

  // --- 2. 액션 핸들러 ---
  const addItem = (type: ItemType) => {
    const id = Date.now();
    const newItem: RoomItem = {
      id, type, name: type === "seat" ? "새 좌석" : "", rotation: 0,
      color: type === "seat" ? "#3b82f6" : type === "wall" ? "#333" : "#94a3b8",
      width: type === "wall" ? 100 : 45, height: type === "wall" ? 6 : 45, x: 50, y: 50
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
  };

  const handleModalConfirm = () => {
    if (modalType === "login") {
      if (modalInput === adminPassword) { setIsAdmin(true); setModalType(null); }
      else { setModalMsg("비밀번호가 올바르지 않습니다."); setModalType("alert"); }
    } else if (modalType === "changePw") {
      if (modalInput.trim()) { setAdminPassword(modalInput); setModalMsg("비밀번호 설정이 완료되었습니다."); setModalType("alert"); }
    } else if (modalType === "saveVersion") {
      const newVer = { id: `V-${Date.now()}`, name: modalInput || "이름 없는 버전", date: new Date().toLocaleString(), data: JSON.parse(JSON.stringify(floors)) };
      setSavedVersions([newVer, ...savedVersions]);
      setModalType("alert"); setModalMsg("현재 배치가 저장되었습니다.");
    } else if (modalType === "confirm") {
      updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
      setSelectedIds([]); setModalType(null);
    } else { setModalType(null); }
    setModalInput("");
  };

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {/* 모달 시스템 */}
      {modalType && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <h3 style={{ marginBottom: "20px", fontWeight: "bold" }}>
              {modalType === "login" ? "관리자 인증" : modalType === "changePw" ? "비밀번호 설정" : modalType === "saveVersion" ? "배치도 버전 저장" : "알림"}
            </h3>
            <div style={{ padding: "0 25px" }}>
              {["login", "changePw", "saveVersion"].includes(modalType!) && (
                <input 
                  type={modalType === "saveVersion" ? "text" : "password"}
                  value={modalInput} onChange={(e) => setModalInput(e.target.value)}
                  style={modalInputS} placeholder={modalType === "saveVersion" ? "버전 이름 (예: 3월 배치)" : "비밀번호 입력"}
                  autoFocus onKeyDown={(e) => e.key === "Enter" && handleModalConfirm()}
                />
              )}
              {(modalType === "alert" || modalType === "confirm") && <p style={{fontSize: "14px"}}>{modalMsg}</p>}
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
        {isAdmin ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} /> : <h2 style={{fontWeight: "bold", fontSize: "16px"}}>{appTitle}</h2>}
        
        {isAdmin && (
          <>
            <div style={statsCardS}>
              <div style={{fontWeight: "800", borderBottom: "1px solid #eee", paddingBottom: "5px", marginBottom: "8px"}}>총 {stats.total}석</div>
              {Object.entries(stats.teams).map(([color, count]: any) => (
                <div key={color} style={{display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px"}}>
                  <span>{teamNames[color] || "미지정"}</span><b>{count}석</b>
                </div>
              ))}
            </div>
            <div style={{marginBottom: "20px"}}>
              <label style={labelS}>히스토리 (버전 관리)</label>
              <div style={versionListS}>
                {savedVersions.map(v => (
                  <div key={v.id} onClick={() => setFloors(v.data)} style={versionItemS}>
                    <b>{v.name}</b><br/><small>{v.date}</small>
                  </div>
                ))}
              </div>
              <button onClick={() => setModalType("saveVersion")} style={saveVerBtnS}>현재 배치 저장</button>
            </div>
          </>
        )}

        <div style={{marginBottom: "20px"}}>
          <label style={labelS}>층 선택</label>
          {floors.map(f => (
            <button key={f.id} onClick={() => setActiveFloorId(f.id)} style={floorBtnS(activeFloorId === f.id)}>{f.displayName}</button>
          ))}
        </div>

        <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px"}}>
          {isAdmin && (
            <div style={{display: "grid", gridTemplateColumns: "1fr", gap: "5px", marginBottom: "10px"}}>
              <button onClick={() => addItem("seat")} style={actionBtnS("#eff6ff", "#2563eb")}>+ 좌석 추가</button>
              <div style={{display: "flex", gap: "5px"}}>
                <button onClick={() => addItem("wall")} style={{...actionBtnS("#f8fafc", "#1e293b"), flex: 1}}>+ 벽 추가</button>
                <button onClick={() => addItem("door")} style={{...actionBtnS("#ecfdf5", "#10b981"), flex: 1}}>+ 문 추가</button>
              </div>
            </div>
          )}
          {isAdmin && <button onClick={() => setModalType("changePw")} style={pwBtnS}>비밀번호 변경</button>}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")} style={adminBtnS(isAdmin)}>{isAdmin ? "편집 종료" : "관리자 로그인"}</button>
        </div>
      </div>

      {/* 캔버스 영역 */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        <div ref={canvasRef} style={canvasS} onMouseDown={(e) => { if(e.target === canvasRef.current) setSelectedIds([]); }}>
          {currentItems.map((item) => (
            <DraggableComponent key={item.id} item={item} isSelected={selectedIds.includes(item.id)} isAdmin={isAdmin} onSelect={() => setSelectedIds([item.id])} onDrag={(data:any) => updateItems(currentItems.map(i => i.id === item.id ? { ...i, x: data.x, y: data.y } : i))} />
          ))}
        </div>
      </div>

      {/* 오른쪽 설정 패널 */}
      {isAdmin && (
        <div style={rightPanelS}>
          <h2 style={{fontSize: "14px", fontWeight: "bold", marginBottom: "15px"}}>상세 설정</h2>
          {selectedItem ? (
            <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
              <label style={labelS}>이름</label>
              <input value={selectedItem.name} onChange={(e) => updateItems(currentItems.map(i => i.id === selectedItem.id ? {...i, name: e.target.value} : i))} style={inputS} />
              <button onClick={() => updateItems(currentItems.filter(i => i.id !== selectedItem.id))} style={deleteBtnS}>삭제하기</button>
            </div>
          ) : <p style={{color: "#94a3b8", fontSize: "12px", textAlign: "center"}}>항목을 선택하세요.</p>}
        </div>
      )}
    </main>
  );
}

function DraggableComponent({ item, isSelected, isAdmin, onSelect, onDrag }: any) {
  const nodeRef = useRef(null);
  return (
    <Draggable nodeRef={nodeRef} position={{ x: item.x, y: item.y }} onStart={onSelect} onDrag={(e, data) => onDrag(data)} disabled={!isAdmin}>
      <div ref={nodeRef} style={{ position: "absolute", zIndex: isSelected ? 100 : 10 }}>
        <div style={{ 
          width: item.width, height: item.height, backgroundColor: item.color, 
          border: isSelected ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.1)", 
          borderRadius: item.type === "seat" ? "6px" : "0",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold"
        }}>
          {item.name}
        </div>
      </div>
    </Draggable>
  );
}

// --- 스타일 시트 ---
const mainContainerS: any = { display: "flex", height: "100vh", backgroundColor: "#f8fafc" };
const sidebarS: any = { width: "240px", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column" };
const rightPanelS: any = { width: "220px", backgroundColor: "#fff", borderLeft: "1px solid #e2e8f0", padding: "20px" };
const canvasS: any = { width: "100%", height: "100%", backgroundColor: "#fff", borderRadius: "15px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" };
const modalOverlayS: any = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContentS: any = { backgroundColor: "#fff", padding: "30px 0", borderRadius: "20px", width: "320px", textAlign: "center" };
const modalInputS: any = { width: "80%", padding: "10px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "10px" };
const adminBtnS: any = (adm: boolean) => ({ padding: "10px", backgroundColor: adm ? "#1e293b" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" });
const subBtnS: any = { padding: "10px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff", cursor: "pointer" };
const actionBtnS: any = (bg: string, co: string) => ({ padding: "10px", backgroundColor: bg, color: co, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" });
const floorBtnS: any = (act: boolean) => ({ width: "100%", padding: "8px", backgroundColor: act ? "#2563eb" : "#f1f5f9", color: act ? "#fff" : "#64748b", border: "none", borderRadius: "6px", marginBottom: "5px", cursor: "pointer" });
const statsCardS: any = { padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "15px" };
const versionListS: any = { maxHeight: "100px", overflowY: "auto", border: "1px solid #eee", padding: "5px", borderRadius: "5px", marginBottom: "5px" };
const versionItemS: any = { padding: "5px", borderBottom: "1px solid #f9f9f9", cursor: "pointer", fontSize: "11px" };
const saveVerBtnS: any = { width: "100%", padding: "6px", background: "#f1f5f9", border: "none", borderRadius: "4px", fontSize: "11px", cursor: "pointer" };
const labelS: any = { fontSize: "11px", color: "#94a3b8", fontWeight: "bold", marginBottom: "5px", display: "block" };
const inputS: any = { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px" };
const deleteBtnS: any = { padding: "8px", backgroundColor: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" };
const pwBtnS: any = { background: "none", border: "none", color: "#94a3b8", fontSize: "11px", cursor: "pointer", textDecoration: "underline", marginBottom: "5px" };
const titleEditS: any = { fontSize: "16px", fontWeight: "bold", border: "1px solid #2563eb", borderRadius: "4px", width: "100%", marginBottom: "15px", padding: "4px" };
