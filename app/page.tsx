"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Draggable from "react-draggable";

// --- 타입 정의 ---
type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; textColor: string; opacity: number; textOpacity: number;
  width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }

// ✅ 스냅 거리 설정
const SNAP_THRESHOLD = 12;
const GRID_SIZE = 10;

// ✅ 두 아이템 간 스냅 계산 (자석 기능)
function getSnapPosition(
  dragging: RoomItem,
  others: RoomItem[],
  rawX: number,
  rawY: number
): { x: number; y: number; snappedX: boolean; snappedY: boolean } {
  let bestX = rawX;
  let bestY = rawY;
  let snapDistX = SNAP_THRESHOLD + 1;
  let snapDistY = SNAP_THRESHOLD + 1;

  const dLeft = rawX;
  const dRight = rawX + dragging.width;
  const dTop = rawY;
  const dBottom = rawY + dragging.height;
  const dCenterX = rawX + dragging.width / 2;
  const dCenterY = rawY + dragging.height / 2;

  for (const other of others) {
    if (other.id === dragging.id) continue;
    const oLeft = other.x;
    const oRight = other.x + other.width;
    const oTop = other.y;
    const oBottom = other.y + other.height;
    const oCenterX = other.x + other.width / 2;
    const oCenterY = other.y + other.height / 2;

    // X축 스냅 후보들
    const xCandidates: Array<{ drag: number; target: number }> = [
      { drag: dLeft, target: oLeft },
      { drag: dLeft, target: oRight + 4 },
      { drag: dRight, target: oRight },
      { drag: dRight, target: oLeft - 4 },
      { drag: dCenterX, target: oCenterX },
    ];
    for (const c of xCandidates) {
      const dist = Math.abs(c.drag - c.target);
      if (dist < snapDistX) {
        snapDistX = dist;
        bestX = rawX + (c.target - c.drag);
      }
    }

    // Y축 스냅 후보들
    const yCandidates: Array<{ drag: number; target: number }> = [
      { drag: dTop, target: oTop },
      { drag: dTop, target: oBottom + 4 },
      { drag: dBottom, target: oBottom },
      { drag: dBottom, target: oTop - 4 },
      { drag: dCenterY, target: oCenterY },
    ];
    for (const c of yCandidates) {
      const dist = Math.abs(c.drag - c.target);
      if (dist < snapDistY) {
        snapDistY = dist;
        bestY = rawY + (c.target - c.drag);
      }
    }
  }

  // 그리드 스냅 (다른 아이템 스냅이 없을 때)
  if (snapDistX > SNAP_THRESHOLD) bestX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
  if (snapDistY > SNAP_THRESHOLD) bestY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

  return {
    x: bestX,
    y: bestY,
    snappedX: snapDistX <= SNAP_THRESHOLD,
    snappedY: snapDistY <= SNAP_THRESHOLD,
  };
}

// ✅ 겹침 감지
function isOverlapping(a: RoomItem, b: RoomItem): boolean {
  if (a.id === b.id) return false;
  const margin = 2;
  return (
    a.x < b.x + b.width - margin &&
    a.x + a.width > b.x + margin &&
    a.y < b.y + b.height - margin &&
    a.y + a.height > b.y + margin
  );
}

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword] = useState("1234");

  const [floors, setFloors] = useState<FloorInfo[]>([{ id: "F1", displayName: "1층", items: [] }]);
  const [activeFloorId, setActiveFloorId] = useState<string>("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [history, setHistory] = useState<FloorInfo[][]>([]);
  const [customPalette] = useState<string[]>(["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#f43f5e"]);

  // ✅ 스냅 가이드라인 표시
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});
  // ✅ 겹침 중인 아이템 ID
  const [overlappingIds, setOverlappingIds] = useState<Set<number>>(new Set());

  const [modalType, setModalType] = useState<"login" | null>(null);
  const [modalInput, setModalInput] = useState("");

  // ✅ 다중 선택 드래그 (박스 셀렉션)
  const [boxSelect, setBoxSelect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const isBoxSelecting = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);

  const currentFloor = useMemo(() => floors.find(f => f.id === activeFloorId) || floors[0], [floors, activeFloorId]);
  const currentItems = currentFloor.items;
  const selectedItems = useMemo(() => currentItems.filter(i => selectedIds.includes(i.id)), [currentItems, selectedIds]);

  const saveHistory = useCallback(() =>
    setHistory(prev => [...prev.slice(-29), JSON.parse(JSON.stringify(floors))]),
    [floors]
  );

  const updateItems = useCallback((newItems: RoomItem[]) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, items: newItems } : f));
    // 겹침 감지 업데이트
    const overlapping = new Set<number>();
    for (let i = 0; i < newItems.length; i++) {
      for (let j = i + 1; j < newItems.length; j++) {
        if (isOverlapping(newItems[i], newItems[j])) {
          if (newItems[i].type === "seat" && newItems[j].type === "seat") {
            overlapping.add(newItems[i].id);
            overlapping.add(newItems[j].id);
          }
        }
      }
    }
    setOverlappingIds(overlapping);
  }, [activeFloorId]);

  const addItem = (type: ItemType) => {
    saveHistory();
    const id = Date.now();
    const newItem: RoomItem = {
      id, type,
      name: type === "seat" ? "새 좌석" : type === "wall" ? "" : "출입문",
      rotation: 0,
      color: type === "seat" ? "#3b82f6" : type === "wall" ? "#475569" : "#10b981",
      textColor: "#fff", opacity: 1, textOpacity: 1,
      width: type === "wall" ? 150 : 50,
      height: type === "wall" ? 12 : 50,
      x: 120, y: 120
    };
    updateItems([...currentItems, newItem]);
    setSelectedIds([id]);
  };

  // ✅ 정렬
  const alignObjects = (type: "left" | "right" | "top" | "bottom" | "centerH" | "centerV" | "distributeH" | "distributeV") => {
    if (selectedItems.length < 2) return;
    saveHistory();
    let newItems = [...currentItems];

    if (type === "left") {
      const minX = Math.min(...selectedItems.map(i => i.x));
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, x: minX } : i);
    } else if (type === "right") {
      const maxX = Math.max(...selectedItems.map(i => i.x + i.width));
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, x: maxX - i.width } : i);
    } else if (type === "top") {
      const minY = Math.min(...selectedItems.map(i => i.y));
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, y: minY } : i);
    } else if (type === "bottom") {
      const maxY = Math.max(...selectedItems.map(i => i.y + i.height));
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, y: maxY - i.height } : i);
    } else if (type === "centerH") {
      const avgY = selectedItems.reduce((acc, cur) => acc + cur.y + cur.height / 2, 0) / selectedItems.length;
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, y: avgY - i.height / 2 } : i);
    } else if (type === "centerV") {
      const avgX = selectedItems.reduce((acc, cur) => acc + cur.x + cur.width / 2, 0) / selectedItems.length;
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, x: avgX - i.width / 2 } : i);
    } else if (type === "distributeH") {
      const sorted = [...selectedItems].sort((a, b) => a.x - b.x);
      const totalWidth = sorted.reduce((acc, i) => acc + i.width, 0);
      const totalSpace = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x - totalWidth;
      const gap = totalSpace / (sorted.length - 1);
      let curX = sorted[0].x;
      const posMap: Record<number, number> = {};
      sorted.forEach((item, idx) => { posMap[item.id] = curX; curX += item.width + gap; });
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, x: posMap[i.id] ?? i.x } : i);
    } else if (type === "distributeV") {
      const sorted = [...selectedItems].sort((a, b) => a.y - b.y);
      const totalHeight = sorted.reduce((acc, i) => acc + i.height, 0);
      const totalSpace = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height - sorted[0].y - totalHeight;
      const gap = totalSpace / (sorted.length - 1);
      let curY = sorted[0].y;
      const posMap: Record<number, number> = {};
      sorted.forEach((item) => { posMap[item.id] = curY; curY += item.height + gap; });
      newItems = newItems.map(i => selectedIds.includes(i.id) ? { ...i, y: posMap[i.id] ?? i.y } : i);
    }

    updateItems(newItems);
  };

  // ✅ 회전
  const rotateObjects = (deg: number) => {
    if (selectedIds.length === 0) return;
    saveHistory();
    updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: (i.rotation + deg + 360) % 360 } : i));
  };

  // ✅ 복제
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

  // ✅ 전체 선택
  const selectAll = () => setSelectedIds(currentItems.map(i => i.id));

  // ✅ 박스 셀렉션
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return;
    if (!isAdmin) { setSelectedIds([]); return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    isBoxSelecting.current = true;
    setBoxSelect({ startX, startY, endX: startX, endY: startY });
    setSelectedIds([]);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isBoxSelecting.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    setBoxSelect(prev => prev ? { ...prev, endX, endY } : null);
  };

  const handleCanvasMouseUp = () => {
    if (!isBoxSelecting.current || !boxSelect) return;
    isBoxSelecting.current = false;
    const selLeft = Math.min(boxSelect.startX, boxSelect.endX);
    const selRight = Math.max(boxSelect.startX, boxSelect.endX);
    const selTop = Math.min(boxSelect.startY, boxSelect.endY);
    const selBottom = Math.max(boxSelect.startY, boxSelect.endY);
    if (selRight - selLeft > 5 && selBottom - selTop > 5) {
      const hit = currentItems.filter(item =>
        item.x < selRight && item.x + item.width > selLeft &&
        item.y < selBottom && item.y + item.height > selTop
      );
      setSelectedIds(hit.map(i => i.id));
    }
    setBoxSelect(null);
  };

  // ✅ 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isAdmin) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (history.length > 0) {
          setFloors(history[history.length - 1]);
          setHistory(prev => prev.slice(0, -1));
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0 && document.activeElement?.tagName !== "INPUT") {
          saveHistory();
          updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
          setSelectedIds([]);
        }
      }
      // 화살표 키로 미세 이동
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selectedIds.length > 0) {
        if (document.activeElement?.tagName === "INPUT") return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin, history, selectedIds, currentItems, duplicateSelected, saveHistory, updateItems]);

  if (!hasMounted) return null;

  return (
    <main style={mainContainerS}>
      {/* 모달 */}
      {modalType === "login" && (
        <div style={modalOverlayS}>
          <div style={modalContentS}>
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔐</div>
            <h3 style={{ marginBottom: "15px", fontWeight: "700", fontSize: "15px", color: "#1e293b" }}>관리자 로그인</h3>
            <input
              type="password" value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (modalInput === adminPassword) setIsAdmin(true);
                  setModalType(null); setModalInput("");
                }
              }}
              placeholder="비밀번호 입력"
              style={modalInputS} autoFocus
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "15px" }}>
              <button onClick={() => {
                if (modalInput === adminPassword) setIsAdmin(true);
                setModalType(null); setModalInput("");
              }} style={confirmBtnS}>확인</button>
              <button onClick={() => { setModalType(null); setModalInput(""); }} style={cancelBtnS}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ───── 왼쪽 사이드바 ───── */}
      <div style={sidebarS}>
        {isAdmin
          ? <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} style={titleEditS} />
          : <h2 style={{ fontWeight: "800", fontSize: "15px", marginBottom: "20px", color: "#1e293b", letterSpacing: "-0.3px" }}>{appTitle}</h2>
        }

        {/* 층 선택 */}
        <div style={{ marginBottom: "18px" }}>
          <div style={sectionLabelS}>📍 층 이동</div>
          {floors.map((f) => (
            <button key={f.id} onClick={() => setActiveFloorId(f.id)}
              style={{ ...floorBtnS(activeFloorId === f.id), width: "100%", marginBottom: "4px" }}>
              {f.displayName}
            </button>
          ))}
        </div>

        {/* 아이템 추가 */}
        {isAdmin && (
          <div style={{ marginBottom: "18px" }}>
            <div style={sectionLabelS}>➕ 요소 추가</div>
            <button onClick={() => addItem("seat")} style={addBtnS("#eff6ff", "#2563eb", "#dbeafe")}>
              🪑 좌석 추가
            </button>
            <button onClick={() => addItem("wall")} style={addBtnS("#f8fafc", "#475569", "#e2e8f0")}>
              🧱 벽체 추가
            </button>
            <button onClick={() => addItem("door")} style={addBtnS("#ecfdf5", "#10b981", "#d1fae5")}>
              🚪 문 추가
            </button>
          </div>
        )}

        {/* 단축키 안내 */}
        {isAdmin && (
          <div style={shortcutBoxS}>
            <div style={sectionLabelS}>⌨️ 단축키</div>
            {[
              ["Ctrl+Z", "되돌리기"],
              ["Ctrl+D", "복제"],
              ["Ctrl+A", "전체선택"],
              ["Del", "삭제"],
              ["←↑→↓", "미세 이동"],
              ["Shift+화살표", "10px 이동"],
              ["드래그", "박스 선택"],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", backgroundColor: "#e2e8f0", padding: "1px 5px", borderRadius: "3px", fontFamily: "monospace", color: "#475569" }}>{key}</span>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{desc}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "auto" }}>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setModalType("login")}
            style={loginBtnS(isAdmin)}>
            {isAdmin ? "✅ 편집 종료" : "🔐 관리자 로그인"}
          </button>
        </div>
      </div>

      {/* ───── 메인 캔버스 ───── */}
      <div style={{ flex: 1, padding: "20px", position: "relative", overflow: "hidden" }}>

        {/* 상단 툴바 */}
        {isAdmin && (
          <div style={topToolbarS}>
            <button onClick={() => {
              if (history.length > 0) { setFloors(history[history.length - 1]); setHistory(prev => prev.slice(0, -1)); }
            }} style={toolbarBtnS} title="되돌리기 (Ctrl+Z)">↩ 되돌리기</button>
            <button onClick={selectAll} style={toolbarBtnS} title="전체 선택 (Ctrl+A)">☑ 전체선택</button>
            <button onClick={duplicateSelected} style={toolbarBtnS} disabled={selectedIds.length === 0} title="복제 (Ctrl+D)">⿻ 복제</button>
            <div style={{ width: "1px", height: "20px", backgroundColor: "#e2e8f0", margin: "0 4px" }} />
            {overlappingIds.size > 0 && (
              <span style={{ fontSize: "11px", color: "#ef4444", backgroundColor: "#fef2f2", padding: "4px 10px", borderRadius: "20px", border: "1px solid #fecaca" }}>
                ⚠ {overlappingIds.size}개 좌석 겹침
              </span>
            )}
          </div>
        )}

        <div
          ref={canvasRef}
          style={canvasS}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* 스냅 가이드라인 */}
          {snapGuides.x !== undefined && (
            <div style={{ position: "absolute", left: snapGuides.x, top: 0, bottom: 0, width: "1px", backgroundColor: "#2563eb", opacity: 0.6, zIndex: 200, pointerEvents: "none" }} />
          )}
          {snapGuides.y !== undefined && (
            <div style={{ position: "absolute", top: snapGuides.y, left: 0, right: 0, height: "1px", backgroundColor: "#2563eb", opacity: 0.6, zIndex: 200, pointerEvents: "none" }} />
          )}

          {/* 박스 셀렉션 사각형 */}
          {boxSelect && (
            <div style={{
              position: "absolute",
              left: Math.min(boxSelect.startX, boxSelect.endX),
              top: Math.min(boxSelect.startY, boxSelect.endY),
              width: Math.abs(boxSelect.endX - boxSelect.startX),
              height: Math.abs(boxSelect.endY - boxSelect.startY),
              border: "1.5px dashed #2563eb",
              backgroundColor: "rgba(37,99,235,0.06)",
              zIndex: 300,
              pointerEvents: "none",
              borderRadius: "3px",
            }} />
          )}

          {currentItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isOverlap = overlappingIds.has(item.id);
            return (
              <Draggable
                key={item.id}
                position={{ x: item.x, y: item.y }}
                onStart={() => {
                  if (!isSelected) setSelectedIds([item.id]);
                }}
                onDrag={(e, data) => {
                  const dx = data.x - item.x;
                  const dy = data.y - item.y;
                  // 이동할 모든 아이템의 새 위치 계산 (스냅은 대표 아이템 기준)
                  const movedItems = currentItems.map(i => {
                    const targetIds = isSelected ? selectedIds : [item.id];
                    if (!targetIds.includes(i.id)) return i;
                    return { ...i, x: i.x + dx, y: i.y + dy };
                  });

                  // 대표 아이템 스냅 계산
                  const rep = movedItems.find(i => i.id === item.id)!;
                  const others = movedItems.filter(i => !(isSelected ? selectedIds : [item.id]).includes(i.id));
                  const snapped = getSnapPosition(rep, others, rep.x, rep.y);
                  const snapDx = snapped.x - rep.x;
                  const snapDy = snapped.y - rep.y;

                  // 스냅 가이드라인
                  setSnapGuides({
                    x: snapped.snappedX ? snapped.x : undefined,
                    y: snapped.snappedY ? snapped.y : undefined,
                  });

                  const finalItems = movedItems.map(i => {
                    const targetIds = isSelected ? selectedIds : [item.id];
                    if (!targetIds.includes(i.id)) return i;
                    return { ...i, x: i.x + snapDx, y: i.y + snapDy };
                  });
                  updateItems(finalItems);
                }}
                onStop={() => {
                  saveHistory();
                  setSnapGuides({});
                }}
                disabled={!isAdmin}
              >
                <div
                  style={{ position: "absolute", zIndex: isSelected ? 100 : 10 }}
                  onClick={(e) => {
                    if (!isAdmin) return;
                    e.stopPropagation();
                    if (e.shiftKey) {
                      setSelectedIds(prev =>
                        prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                      );
                    } else {
                      setSelectedIds([item.id]);
                    }
                  }}
                >
                  <div style={{
                    transform: `rotate(${item.rotation}deg)`,
                    width: item.width,
                    height: item.height,
                    backgroundColor: isOverlap ? "#fee2e2" : item.color,
                    border: isSelected
                      ? "2px solid #2563eb"
                      : isOverlap
                        ? "2px solid #ef4444"
                        : "1px solid rgba(0,0,0,0.1)",
                    borderRadius: item.type === "wall" ? "3px" : "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isOverlap ? "#ef4444" : item.textColor,
                    fontSize: "11px",
                    fontWeight: "700",
                    textAlign: "center",
                    cursor: isAdmin ? "grab" : "default",
                    boxShadow: isSelected
                      ? "0 0 0 3px rgba(37,99,235,0.2)"
                      : isOverlap
                        ? "0 0 0 3px rgba(239,68,68,0.2)"
                        : "0 1px 3px rgba(0,0,0,0.08)",
                    transition: "box-shadow 0.1s, border-color 0.1s",
                    userSelect: "none",
                  }}>
                    {item.name}
                    {isSelected && isAdmin && (
                      <div style={{
                        position: "absolute",
                        top: "-6px", right: "-6px",
                        width: "12px", height: "12px",
                        backgroundColor: "#2563eb",
                        borderRadius: "50%",
                        border: "2px solid white",
                      }} />
                    )}
                  </div>
                </div>
              </Draggable>
            );
          })}
        </div>
      </div>

      {/* ───── 우측 속성 패널 ───── */}
      {isAdmin && (
        <div style={rightPanelS}>
          {selectedItems.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "12px", paddingTop: "30px" }}>
              <div style={{ fontSize: "32px", marginBottom: "10px" }}>👆</div>
              좌석을 클릭하거나<br />드래그로 다중 선택하세요
            </div>
          ) : (
            <>
              {/* 선택 정보 */}
              <div style={propCardS}>
                <div style={sectionLabelS}>📌 선택 정보</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {selectedItems.length === 1 ? selectedItems[0].name : `${selectedItems.length}개 선택됨`}
                </div>
              </div>

              {/* 이름/크기 (단일 선택 시) */}
              {selectedItems.length === 1 && (
                <div style={propCardS}>
                  <div style={sectionLabelS}>✏️ 이름 / 크기</div>
                  <input
                    value={selectedItems[0].name}
                    onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, name: e.target.value } : i))}
                    style={inputS}
                    placeholder="이름 입력"
                  />
                  <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: "2px" }}>너비(W)</div>
                      <input type="number"
                        value={selectedItems[0].width}
                        onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, width: +e.target.value } : i))}
                        style={inputS}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: "2px" }}>높이(H)</div>
                      <input type="number"
                        value={selectedItems[0].height}
                        onChange={(e) => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, height: +e.target.value } : i))}
                        style={inputS}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 색상 */}
              <div style={propCardS}>
                <div style={sectionLabelS}>🎨 색상</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {customPalette.map(c => (
                    <div key={c}
                      onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, color: c } : i))}
                      style={{
                        width: "22px", height: "22px", borderRadius: "50%",
                        backgroundColor: c, cursor: "pointer",
                        border: selectedItems[0]?.color === c ? "2px solid #1e293b" : "2px solid transparent",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        transition: "transform 0.1s",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* ✅ 회전 */}
              <div style={propCardS}>
                <div style={sectionLabelS}>🔄 회전</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                  <button onClick={() => rotateObjects(90)} style={utilBtnS("🔁", "#f0f9ff")}>90° →</button>
                  <button onClick={() => rotateObjects(-90)} style={utilBtnS("🔁", "#f0f9ff")}>← 90°</button>
                  <button onClick={() => rotateObjects(45)} style={utilBtnS("↻", "#f0f9ff")}>45° →</button>
                  <button onClick={() => rotateObjects(180)} style={utilBtnS("🔃", "#f0f9ff")}>180°</button>
                </div>
                {/* 현재 회전값 표시 (단일 선택) */}
                {selectedItems.length === 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "4px" }}>
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>현재:</span>
                    <input
                      type="number"
                      value={selectedItems[0].rotation}
                      onChange={(e) => {
                        const deg = ((+e.target.value) % 360 + 360) % 360;
                        updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: deg } : i));
                      }}
                      style={{ ...inputS, width: "60px" }}
                    />
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>°</span>
                    <button onClick={() => updateItems(currentItems.map(i => selectedIds.includes(i.id) ? { ...i, rotation: 0 } : i))}
                      style={{ fontSize: "10px", padding: "3px 6px", border: "1px solid #e2e8f0", borderRadius: "4px", cursor: "pointer", backgroundColor: "#f8fafc", color: "#64748b" }}>
                      리셋
                    </button>
                  </div>
                )}
              </div>

              {/* ✅ 정렬 */}
              <div style={propCardS}>
                <div style={sectionLabelS}>📐 정렬 {selectedItems.length < 2 && <span style={{ color: "#fbbf24", fontSize: "9px" }}>(2개 이상 선택)</span>}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", marginBottom: "6px" }}>
                  {[
                    { label: "⬅", type: "left" as const, title: "왼쪽 정렬" },
                    { label: "↔", type: "centerV" as const, title: "중앙 세로 정렬" },
                    { label: "➡", type: "right" as const, title: "오른쪽 정렬" },
                    { label: "⬆", type: "top" as const, title: "위쪽 정렬" },
                    { label: "↕", type: "centerH" as const, title: "중앙 가로 정렬" },
                    { label: "⬇", type: "bottom" as const, title: "아래쪽 정렬" },
                  ].map(btn => (
                    <button key={btn.type}
                      onClick={() => alignObjects(btn.type)}
                      disabled={selectedItems.length < 2}
                      title={btn.title}
                      style={{
                        padding: "7px 4px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "5px",
                        fontSize: "14px",
                        cursor: selectedItems.length >= 2 ? "pointer" : "not-allowed",
                        backgroundColor: selectedItems.length >= 2 ? "#f8fafc" : "#f1f5f9",
                        opacity: selectedItems.length >= 2 ? 1 : 0.4,
                        transition: "background 0.1s",
                      }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
                {/* 간격 균등 배분 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                  <button
                    onClick={() => alignObjects("distributeH")}
                    disabled={selectedItems.length < 3}
                    style={{
                      padding: "6px", fontSize: "10px", border: "1px solid #e2e8f0",
                      borderRadius: "5px", cursor: selectedItems.length >= 3 ? "pointer" : "not-allowed",
                      backgroundColor: "#f8fafc", opacity: selectedItems.length >= 3 ? 1 : 0.4,
                    }}
                    title="가로 균등 배분 (3개 이상)">
                    ↔ 균등배분
                  </button>
                  <button
                    onClick={() => alignObjects("distributeV")}
                    disabled={selectedItems.length < 3}
                    style={{
                      padding: "6px", fontSize: "10px", border: "1px solid #e2e8f0",
                      borderRadius: "5px", cursor: selectedItems.length >= 3 ? "pointer" : "not-allowed",
                      backgroundColor: "#f8fafc", opacity: selectedItems.length >= 3 ? 1 : 0.4,
                    }}
                    title="세로 균등 배분 (3개 이상)">
                    ↕ 균등배분
                  </button>
                </div>
              </div>

              {/* ✅ 편집 도구 */}
              <div style={propCardS}>
                <div style={sectionLabelS}>🛠 편집</div>
                <button onClick={duplicateSelected} style={{
                  width: "100%", padding: "8px", border: "1px solid #d1fae5",
                  borderRadius: "6px", fontSize: "12px", cursor: "pointer",
                  backgroundColor: "#ecfdf5", color: "#10b981", fontWeight: "700", marginBottom: "5px",
                }}>⿻ 복제 (Ctrl+D)</button>
                <button onClick={() => {
                  saveHistory();
                  updateItems(currentItems.filter(i => !selectedIds.includes(i.id)));
                  setSelectedIds([]);
                }} style={{
                  width: "100%", padding: "8px", border: "1px solid #fecaca",
                  borderRadius: "6px", fontSize: "12px", cursor: "pointer",
                  backgroundColor: "#fef2f2", color: "#ef4444", fontWeight: "700",
                }}>🗑 삭제 (Del)</button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

// ───── 스타일 ─────
const mainContainerS: React.CSSProperties = {
  display: "flex", height: "100vh", backgroundColor: "#f1f5f9", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
};
const sidebarS: React.CSSProperties = {
  width: "220px", backgroundColor: "#fff", padding: "16px",
  borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column",
  boxShadow: "2px 0 8px rgba(0,0,0,0.03)",
};
const rightPanelS: React.CSSProperties = {
  width: "220px", backgroundColor: "#fff", padding: "16px",
  borderLeft: "1px solid #e2e8f0", overflowY: "auto",
  boxShadow: "-2px 0 8px rgba(0,0,0,0.03)",
};
const canvasS: React.CSSProperties = {
  width: "100%", height: "100%", borderRadius: "14px",
  border: "1px solid #e2e8f0", position: "relative",
  backgroundColor: "#fafafa",
  backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
  backgroundSize: "20px 20px",
  overflow: "hidden",
};
const topToolbarS: React.CSSProperties = {
  position: "absolute", top: "20px", left: "20px",
  display: "flex", gap: "6px", zIndex: 100, alignItems: "center",
};
const toolbarBtnS: React.CSSProperties = {
  padding: "6px 12px", backgroundColor: "#fff", border: "1px solid #e2e8f0",
  borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontWeight: "600",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)", color: "#475569",
};
const modalOverlayS: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000,
  backdropFilter: "blur(4px)",
};
const modalContentS: React.CSSProperties = {
  backgroundColor: "#fff", padding: "28px 24px", borderRadius: "16px",
  width: "300px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};
const modalInputS: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0",
  borderRadius: "8px", fontSize: "14px", outline: "none",
  boxSizing: "border-box",
};
const confirmBtnS: React.CSSProperties = {
  padding: "10px 24px", backgroundColor: "#2563eb", color: "#fff",
  border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "700",
};
const cancelBtnS: React.CSSProperties = {
  padding: "10px 24px", border: "1px solid #e2e8f0", borderRadius: "8px",
  cursor: "pointer", fontSize: "13px", color: "#64748b", backgroundColor: "#f8fafc",
};
const loginBtnS = (isAdmin: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px", backgroundColor: isAdmin ? "#1e293b" : "#2563eb",
  color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer",
  fontSize: "12px", fontWeight: "700",
});
const addBtnS = (bg: string, color: string, border: string): React.CSSProperties => ({
  width: "100%", padding: "9px 12px", backgroundColor: bg, color, border: `1px solid ${border}`,
  borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "12px",
  marginBottom: "5px", textAlign: "left",
});
const floorBtnS = (active: boolean): React.CSSProperties => ({
  padding: "8px 10px", backgroundColor: active ? "#2563eb" : "#f8fafc",
  color: active ? "#fff" : "#64748b", border: `1px solid ${active ? "#2563eb" : "#e2e8f0"}`,
  borderRadius: "6px", cursor: "pointer", textAlign: "left", fontSize: "12px", fontWeight: "600",
});
const propCardS: React.CSSProperties = {
  padding: "12px", border: "1px solid #f1f5f9", borderRadius: "10px",
  marginBottom: "8px", backgroundColor: "#fafafa",
};
const sectionLabelS: React.CSSProperties = {
  fontSize: "10px", color: "#94a3b8", display: "block",
  marginBottom: "8px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px",
};
const inputS: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0",
  borderRadius: "6px", fontSize: "12px", boxSizing: "border-box",
  outline: "none", backgroundColor: "#fff",
};
const utilBtnS = (_icon: string, bg: string): React.CSSProperties => ({
  padding: "7px 4px", border: "1px solid #e2e8f0", borderRadius: "6px",
  fontSize: "12px", cursor: "pointer", backgroundColor: bg, fontWeight: "600",
  color: "#374151",
});
const titleEditS: React.CSSProperties = {
  fontSize: "14px", fontWeight: "800", border: "2px solid #2563eb",
  borderRadius: "8px", width: "100%", marginBottom: "16px", padding: "8px",
  boxSizing: "border-box",
};
const shortcutBoxS: React.CSSProperties = {
  backgroundColor: "#f8fafc", borderRadius: "8px", padding: "10px",
  marginBottom: "16px", border: "1px solid #f1f5f9",
};
