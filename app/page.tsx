"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Draggable from "react-draggable";

// ─── 타입 ─────────────────────────────────────────────────
type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; textColor: string; opacity: number; textOpacity: number;
  width: number; height: number; x: number; y: number;
}
interface Zone {
  id: number; name: string; color: string;
  x: number; y: number; width: number; height: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; zones: Zone[]; }
interface Department { id: string; name: string; color: string; }
interface VersionSnapshot { id: string; label: string; savedAt: string; floors: FloorInfo[]; }

// ─── 색상 유틸 ────────────────────────────────────────────
function hexToRgba(hex: string, opacity: number): string {
  const c = hex.replace("#", "");
  return `rgba(${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)},${opacity})`;
}
function rgbaToHexOpacity(rgba: string): { hex: string; opacity: number } {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { hex: rgba.startsWith("#") ? rgba : "#3b82f6", opacity: 1 };
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return { hex: `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`, opacity: m[4] !== undefined ? +m[4] : 1 };
}
function colorToHex(c: string): string {
  if (c.startsWith("#")) return c;
  if (c.startsWith("rgb")) return rgbaToHexOpacity(c).hex;
  return c;
}
function colorToOpacity(c: string): number {
  return c.startsWith("rgba") ? rgbaToHexOpacity(c).opacity : 1;
}
function applyOpacity(color: string, opacity: number): string {
  return hexToRgba(colorToHex(color), opacity);
}

// ─── 스냅 ─────────────────────────────────────────────────
const SNAP_THRESHOLD = 10;
const GRID_SIZE = 10;
const GAP = 1;

function getSnapPosition(dragging: RoomItem, others: RoomItem[], rawX: number, rawY: number) {
  let bX = rawX, bY = rawY, dX = SNAP_THRESHOLD+1, dY = SNAP_THRESHOLD+1;
  const dL=rawX,dR=rawX+dragging.width,dT=rawY,dB=rawY+dragging.height;
  const dCX=rawX+dragging.width/2,dCY=rawY+dragging.height/2;
  for (const o of others) {
    if (o.id===dragging.id) continue;
    const oL=o.x,oR=o.x+o.width,oT=o.y,oB=o.y+o.height,oCX=o.x+o.width/2,oCY=o.y+o.height/2;
    for (const c of [{drag:dL,t:oL},{drag:dL,t:oR+GAP},{drag:dR,t:oR},{drag:dR,t:oL-GAP},{drag:dCX,t:oCX}]) {
      const d=Math.abs(c.drag-c.t); if(d<dX){dX=d;bX=rawX+(c.t-c.drag);}
    }
    for (const c of [{drag:dT,t:oT},{drag:dT,t:oB+GAP},{drag:dB,t:oB},{drag:dB,t:oT-GAP},{drag:dCY,t:oCY}]) {
      const d=Math.abs(c.drag-c.t); if(d<dY){dY=d;bY=rawY+(c.t-c.drag);}
    }
  }
  if(dX>SNAP_THRESHOLD)bX=Math.round(rawX/GRID_SIZE)*GRID_SIZE;
  if(dY>SNAP_THRESHOLD)bY=Math.round(rawY/GRID_SIZE)*GRID_SIZE;
  return {x:bX,y:bY,snappedX:dX<=SNAP_THRESHOLD,snappedY:dY<=SNAP_THRESHOLD};
}

function isOverlapping(a: RoomItem, b: RoomItem): boolean {
  if(a.id===b.id)return false; const m=1;
  return a.x<b.x+b.width-m&&a.x+a.width>b.x+m&&a.y<b.y+b.height-m&&a.y+a.height>b.y+m;
}

function emptyFloor(id: string, displayName: string): FloorInfo {
  return { id, displayName, items: [], zones: [] };
}

// ─── 출입문 ───────────────────────────────────────────────
function DoorShape({w,h,rotation,name,isSelected}:{w:number;h:number;color:string;rotation:number;name:string;isSelected:boolean}) {
  return (
    <div style={{transform:`rotate(${rotation}deg)`,width:w,height:h,backgroundColor:"#fff",
      border:isSelected?"2px solid #2563eb":"2px dashed #94a3b8",borderRadius:"5px",cursor:"grab",
      display:"flex",alignItems:"center",justifyContent:"center",userSelect:"none",
      boxShadow:isSelected?"0 0 0 3px rgba(37,99,235,0.2)":"0 1px 3px rgba(0,0,0,0.06)"}}>
      <span style={{fontSize:"11px",fontWeight:700,color:"#64748b",textAlign:"center"}}>{name||"출입문"}</span>
    </div>
  );
}

// ─── 스포이드 피커 ────────────────────────────────────────
function EyedropperPicker({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
      <span style={{fontSize:"10px",color:"#94a3b8",width:"45px",flexShrink:0}}>{label}</span>
      <div onClick={()=>ref.current?.click()} title="색상 선택"
        style={{width:"22px",height:"22px",borderRadius:"50%",backgroundColor:value,border:"2px solid #e2e8f0",cursor:"pointer",flexShrink:0}}/>
      <input ref={ref} type="color" value={colorToHex(value)}
        onChange={e=>onChange(hexToRgba(e.target.value,colorToOpacity(value)))}
        style={{opacity:0,width:0,height:0,position:"absolute"}}/>
      <code style={{fontSize:"9px",color:"#64748b",backgroundColor:"#f1f5f9",padding:"2px 5px",borderRadius:"3px"}}>{colorToHex(value)}</code>
    </div>
  );
}

// ─── PNG 내보내기 ─────────────────────────────────────────
function exportToPNG(canvasEl: HTMLElement, title: string, floorName: string) {
  // 캔버스 영역을 그대로 캡처: SVG foreignObject 방식 (의존성 없이)
  const rect = canvasEl.getBoundingClientRect();
  const svgNS = "http://www.w3.org/2000/svg";
  const img = new Image();

  // 클론 + foreignObject 사용
  const clone = canvasEl.cloneNode(true) as HTMLElement;
  clone.style.position = "relative";
  // 선택 표시 테두리 제거
  clone.querySelectorAll<HTMLElement>("[data-item]").forEach(el => {
    el.style.outline = "none";
    el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
    el.style.border = "1px solid rgba(0,0,0,0.1)";
  });

  const svgStr = `<svg xmlns="${svgNS}" width="${rect.width}" height="${rect.height}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;overflow:hidden;background:#fafafa;font-family:sans-serif">
        ${clone.outerHTML}
      </div>
    </foreignObject>
  </svg>`;

  const canvas = document.createElement("canvas");
  canvas.width = rect.width * 2;
  canvas.height = (rect.height + 32) * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  img.onload = () => {
    // 배경
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, rect.width, rect.height + 32);
    ctx.drawImage(img, 0, 0);
    // 하단 바
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect(0, rect.height, rect.width, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`${title}  ·  ${floorName}`, 12, rect.height + 16);
    ctx.textAlign = "right";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(new Date().toLocaleDateString("ko-KR"), rect.width - 12, rect.height + 16);
    const link = document.createElement("a");
    link.download = `${title}_${floorName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
}

// ─── 메인 ─────────────────────────────────────────────────
export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");

  const [floors, setFloors] = useState<FloorInfo[]>([emptyFloor("F1","1층")]);
  const [activeFloorId, setActiveFloorId] = useState("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number|null>(null);
  const [undoHistory, setUndoHistory] = useState<FloorInfo[][]>([]);

  const [departments] = useState<Department[]>([
    {id:"d1",name:"기획",color:"#3b82f6"},{id:"d2",name:"개발",color:"#10b981"},
    {id:"d3",name:"디자인",color:"#8b5cf6"},{id:"d4",name:"영업",color:"#f59e0b"},
    {id:"d5",name:"인사",color:"#ef4444"},{id:"d6",name:"재무",color:"#06b6d4"},
    {id:"d7",name:"기타",color:"#64748b"},
  ]);

  const [colorGroupNames, setColorGroupNames] = useState<Record<string,string>>({});
  const [colorGroupOrder, setColorGroupOrder] = useState<string[]>([]);
  const [editingColorHex, setEditingColorHex] = useState<string|null>(null);
  const deptDragIdx = useRef<number|null>(null);

  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [versionLabel, setVersionLabel] = useState("");

  const [customPalette, setCustomPalette] = useState<string[]>([]);
  const [pickColor, setPickColor] = useState("#ff6b6b");
  const pickRef = useRef<HTMLInputElement>(null);

  const [emptyHighlight, setEmptyHighlight] = useState(false);

  // 구역 그리기 상태
  const [zoneDrawMode, setZoneDrawMode] = useState(false);
  const [zoneVisible, setZoneVisible] = useState(true);
  const [zoneDrawing, setZoneDrawing] = useState<{sx:number;sy:number;ex:number;ey:number}|null>(null);
  const isZoneDrawing = useRef(false);

  const [snapGuides, setSnapGuides] = useState<{x?:number;y?:number}>({});
  const [overlappingIds, setOverlappingIds] = useState<Set<number>>(new Set());

  type ModalT = "login"|"changePw"|"saveVersion"|null;
  const [modal, setModal] = useState<ModalT>(null);
  const [mInput, setMInput] = useState("");
  const [mInput2, setMInput2] = useState("");
  const [mErr, setMErr] = useState("");

  const [editingFloorId, setEditingFloorId] = useState<string|null>(null);
  const [editingFloorName, setEditingFloorName] = useState("");

  // 박스 셀렉션
  const [boxSel, setBoxSel] = useState<{sx:number;sy:number;ex:number;ey:number}|null>(null);
  const isBoxing = useRef(false);

  // ★ canvasRef: 실제 캔버스 div
  const canvasRef = useRef<HTMLDivElement>(null);

  type SideTab = "floors"|"versions"|"shortcuts";
  const [sideTab, setSideTab] = useState<SideTab>("floors");

  useEffect(()=>{setHasMounted(true);},[]);

  const curFloor = useMemo(()=>floors.find(f=>f.id===activeFloorId)||floors[0],[floors,activeFloorId]);
  const curItems = curFloor.items;
  const curZones = useMemo(()=>curFloor.zones||[],[curFloor]);
  const selItems = useMemo(()=>curItems.filter(i=>selectedIds.includes(i.id)),[curItems,selectedIds]);
  const allSeats = useMemo(()=>floors.flatMap(f=>f.items.filter(i=>i.type==="seat")),[floors]);
  const curSeats = useMemo(()=>curItems.filter(i=>i.type==="seat"),[curItems]);
  const emptySeats = useMemo(()=>curSeats.filter(s=>!s.name||s.name==="새 좌석"||s.name.trim()===""),[curSeats]);

  const activeColorGroups = useMemo(()=>{
    const hexSet = new Set(allSeats.map(s=>colorToHex(s.color)));
    const hexList = Array.from(hexSet);
    const ordered=[...colorGroupOrder.filter(h=>hexList.includes(h)),...hexList.filter(h=>!colorGroupOrder.includes(h))];
    return ordered.map(hex=>({
      hex, name:colorGroupNames[hex]||departments.find(d=>d.color===hex)?.name||hex,
      totalCount:allSeats.filter(s=>colorToHex(s.color)===hex).length,
      curCount:curSeats.filter(s=>colorToHex(s.color)===hex).length,
    }));
  },[allSeats,curSeats,colorGroupNames,colorGroupOrder,departments]);

  useEffect(()=>{
    const hexSet=new Set(allSeats.map(s=>colorToHex(s.color)));
    setColorGroupOrder(prev=>{
      const nw=Array.from(hexSet).filter(h=>!prev.includes(h));
      return nw.length>0?[...prev,...nw]:prev;
    });
  },[allSeats]);

  const saveHistory = useCallback(()=>
    setUndoHistory(p=>[...p.slice(-29),JSON.parse(JSON.stringify(floors))]),[floors]);

  const updateItems = useCallback((newItems:RoomItem[])=>{
    setFloors(p=>p.map(f=>f.id===activeFloorId?{...f,items:newItems}:f));
    const ov=new Set<number>();
    for(let i=0;i<newItems.length;i++)for(let j=i+1;j<newItems.length;j++)
      if(isOverlapping(newItems[i],newItems[j])&&newItems[i].type==="seat"&&newItems[j].type==="seat"){ov.add(newItems[i].id);ov.add(newItems[j].id);}
    setOverlappingIds(ov);
  },[activeFloorId]);

  const updateZones = useCallback((newZones:Zone[])=>{
    setFloors(p=>p.map(f=>f.id===activeFloorId?{...f,zones:newZones}:f));
  },[activeFloorId]);

  const addItem=(type:ItemType)=>{
    saveHistory();
    const id=Date.now();
    const col=type==="seat"?departments[0].color:type==="wall"?"#475569":"#64748b";
    updateItems([...curItems,{id,type,name:type==="seat"?"새 좌석":type==="wall"?"":"출입문",
      rotation:0,color:col,textColor:"#ffffff",opacity:1,textOpacity:1,
      width:type==="wall"?150:type==="door"?60:50,height:type==="wall"?12:50,x:130,y:130}]);
    setSelectedIds([id]);
  };

  const addFloor=()=>{
    const id=`F${Date.now()}`;
    setFloors(p=>[...p,emptyFloor(id,`${p.length+1}층`)]);
    setActiveFloorId(id);
  };
  const deleteFloor=(fid:string)=>{
    if(floors.length<=1)return;
    const rem=floors.filter(f=>f.id!==fid);
    setFloors(rem);
    if(activeFloorId===fid)setActiveFloorId(rem[0].id);
  };
  const renameFloor=(fid:string,name:string)=>setFloors(p=>p.map(f=>f.id===fid?{...f,displayName:name}:f));

  const alignObjects=(type:"left"|"right"|"top"|"bottom"|"centerH"|"centerV"|"distributeH"|"distributeV")=>{
    if(selItems.length<2)return;saveHistory();
    let ni=[...curItems];
    if(type==="left"){const m=Math.min(...selItems.map(i=>i.x));ni=ni.map(i=>selectedIds.includes(i.id)?{...i,x:m}:i);}
    else if(type==="right"){const m=Math.max(...selItems.map(i=>i.x+i.width));ni=ni.map(i=>selectedIds.includes(i.id)?{...i,x:m-i.width}:i);}
    else if(type==="top"){const m=Math.min(...selItems.map(i=>i.y));ni=ni.map(i=>selectedIds.includes(i.id)?{...i,y:m}:i);}
    else if(type==="bottom"){const m=Math.max(...selItems.map(i=>i.y+i.height));ni=ni.map(i=>selectedIds.includes(i.id)?{...i,y:m-i.height}:i);}
    else if(type==="centerH"){const avg=selItems.reduce((a,c)=>a+c.y+c.height/2,0)/selItems.length;ni=ni.map(i=>selectedIds.includes(i.id)?{...i,y:avg-i.height/2}:i);}
    else if(type==="centerV"){const avg=selItems.reduce((a,c)=>a+c.x+c.width/2,0)/selItems.length;ni=ni.map(i=>selectedIds.includes(i.id)?{...i,x:avg-i.width/2}:i);}
    else if(type==="distributeH"){
      const s=[...selItems].sort((a,b)=>a.x-b.x);const tw=s.reduce((a,i)=>a+i.width,0);
      const ts=s[s.length-1].x+s[s.length-1].width-s[0].x-tw;const gap=ts/(s.length-1);
      let cx=s[0].x;const pm:Record<number,number>={};
      s.forEach(i=>{pm[i.id]=cx;cx+=i.width+gap;});
      ni=ni.map(i=>selectedIds.includes(i.id)?{...i,x:pm[i.id]??i.x}:i);
    } else {
      const s=[...selItems].sort((a,b)=>a.y-b.y);const th=s.reduce((a,i)=>a+i.height,0);
      const ts=s[s.length-1].y+s[s.length-1].height-s[0].y-th;const gap=ts/(s.length-1);
      let cy=s[0].y;const pm:Record<number,number>={};
      s.forEach(i=>{pm[i.id]=cy;cy+=i.height+gap;});
      ni=ni.map(i=>selectedIds.includes(i.id)?{...i,y:pm[i.id]??i.y}:i);
    }
    updateItems(ni);
  };

  const rotateObjects=(deg:number)=>{
    if(!selectedIds.length)return;saveHistory();
    updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,rotation:(i.rotation+deg+360)%360}:i));
  };

  const duplicateSelected=useCallback(()=>{
    if(!selectedIds.length)return;saveHistory();
    const ni=[...curItems];const nsi:number[]=[];
    selItems.forEach(item=>{const nid=Date.now()+Math.random();ni.push({...item,id:nid,x:item.x+20,y:item.y+20});nsi.push(nid);});
    updateItems(ni);setSelectedIds(nsi);
  },[selectedIds,selItems,curItems,saveHistory,updateItems]);

  const selectAll=()=>setSelectedIds(curItems.map(i=>i.id));
  const selectByColor=(color:string)=>setSelectedIds(curItems.filter(i=>colorToHex(i.color)===color).map(i=>i.id));

  const saveVersion=(label:string)=>setVersions(p=>[{id:`v${Date.now()}`,label,savedAt:new Date().toLocaleString("ko-KR"),floors:JSON.parse(JSON.stringify(floors))},...p]);
  const restoreVersion=(v:VersionSnapshot)=>{saveHistory();setFloors(JSON.parse(JSON.stringify(v.floors)));if(!v.floors.find(f=>f.id===activeFloorId))setActiveFloorId(v.floors[0].id);};
  const deleteVersion=(id:string)=>setVersions(p=>p.filter(v=>v.id!==id));

  // PNG 내보내기
  const handleExport=useCallback(()=>{
    if(!canvasRef.current)return;
    exportToPNG(canvasRef.current, appTitle, curFloor.displayName);
  },[appTitle,curFloor]);

  // ★ 핵심 수정: e.target 체크를 canvasRef 하위 요소까지 허용
  // zoneDrawMode면 구역 그리기, 아니면 박스셀렉션
  // 단, 좌석/구역 클릭은 각 요소의 onClick에서 처리하므로 여기선 "빈 공간 클릭"만 처리
  const getCanvasPos=(e:React.MouseEvent|MouseEvent)=>{
    if(!canvasRef.current)return{x:0,y:0};
    const r=canvasRef.current.getBoundingClientRect();
    return{x:e.clientX-r.left,y:e.clientY-r.top};
  };

  const handleCanvasMouseDown=(e:React.MouseEvent<HTMLDivElement>)=>{
    // 좌석/벽/문/구역 요소를 직접 클릭한 경우는 각 요소 핸들러에서 처리
    // 여기선 캔버스 배경(빈 곳) 클릭만 처리
    const target = e.target as HTMLElement;
    const isOnItem = target.closest("[data-item]");
    const isOnZone = target.closest("[data-zone]");
    if(!isAdmin){
      if(!isOnItem&&!isOnZone)setSelectedIds([]);
      return;
    }
    if(zoneDrawMode){
      // 구역 그리기 시작 (어디서 클릭하든)
      const {x,y}=getCanvasPos(e);
      isZoneDrawing.current=true;
      setZoneDrawing({sx:x,sy:y,ex:x,ey:y});
      e.preventDefault();
      return;
    }
    // 박스 셀렉션 - 빈 공간 클릭 시
    if(!isOnItem&&!isOnZone){
      const {x,y}=getCanvasPos(e);
      isBoxing.current=true;
      setBoxSel({sx:x,sy:y,ex:x,ey:y});
      setSelectedIds([]);
      setSelectedZoneId(null);
    }
  };

  const handleCanvasMouseMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(isZoneDrawing.current){
      const {x,y}=getCanvasPos(e);
      setZoneDrawing(p=>p?{...p,ex:x,ey:y}:null);
    } else if(isBoxing.current){
      const {x,y}=getCanvasPos(e);
      setBoxSel(p=>p?{...p,ex:x,ey:y}:null);
    }
  };

  const handleCanvasMouseUp=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(isZoneDrawing.current&&zoneDrawing){
      isZoneDrawing.current=false;
      const x=Math.min(zoneDrawing.sx,zoneDrawing.ex);
      const y=Math.min(zoneDrawing.sy,zoneDrawing.ey);
      const w=Math.abs(zoneDrawing.ex-zoneDrawing.sx);
      const h=Math.abs(zoneDrawing.ey-zoneDrawing.sy);
      if(w>30&&h>30){
        saveHistory();
        const nz:Zone={id:Date.now(),name:"새 구역",color:"#3b82f6",x,y,width:w,height:h};
        updateZones([...curZones,nz]);
        setSelectedZoneId(nz.id);
        setSelectedIds([]);
      }
      setZoneDrawing(null);
      setZoneDrawMode(false);
      return;
    }
    if(isBoxing.current&&boxSel){
      isBoxing.current=false;
      const sl=Math.min(boxSel.sx,boxSel.ex),sr=Math.max(boxSel.sx,boxSel.ex);
      const st=Math.min(boxSel.sy,boxSel.ey),sb=Math.max(boxSel.sy,boxSel.ey);
      if(sr-sl>5&&sb-st>5)
        setSelectedIds(curItems.filter(i=>i.x<sr&&i.x+i.width>sl&&i.y<sb&&i.y+i.height>st).map(i=>i.id));
      setBoxSel(null);
    }
    isBoxing.current=false;
  };

  // 키보드
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(!isAdmin)return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();if(undoHistory.length>0){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));}}
      if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();duplicateSelected();}
      if((e.ctrlKey||e.metaKey)&&e.key==="a"){e.preventDefault();selectAll();}
      if(e.key==="Escape"){setZoneDrawMode(false);isZoneDrawing.current=false;setZoneDrawing(null);}
      if((e.key==="Delete"||e.key==="Backspace")&&document.activeElement?.tagName!=="INPUT"){
        if(selectedZoneId!==null){saveHistory();updateZones(curZones.filter(z=>z.id!==selectedZoneId));setSelectedZoneId(null);}
        else if(selectedIds.length){saveHistory();updateItems(curItems.filter(i=>!selectedIds.includes(i.id)));setSelectedIds([]);}
      }
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selectedIds.length&&document.activeElement?.tagName!=="INPUT"){
        e.preventDefault();const step=e.shiftKey?10:1;
        const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0;
        const dy=e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0;
        updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,x:i.x+dx,y:i.y+dy}:i));
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[isAdmin,undoHistory,selectedIds,selectedZoneId,curItems,curZones,duplicateSelected,saveHistory,updateItems,updateZones]);

  if(!hasMounted)return null;
  const selZone=curZones.find(z=>z.id===selectedZoneId);

  return (
    <main style={{display:"flex",height:"100vh",backgroundColor:"#f1f5f9",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif"}}>

      {/* 모달 */}
      {modal&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.45)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:3000,backdropFilter:"blur(4px)"}}>
          <div style={{backgroundColor:"#fff",padding:"28px 24px",borderRadius:"16px",width:"320px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
            {modal==="login"&&<>
              <div style={{fontSize:"26px",marginBottom:"6px"}}>🔐</div>
              <h3 style={{fontWeight:700,fontSize:"15px",marginBottom:"14px",color:"#1e293b"}}>관리자 로그인</h3>
              <input type="password" value={mInput} onChange={e=>{setMInput(e.target.value);setMErr("");}}
                onKeyDown={e=>{if(e.key==="Enter"){if(mInput===adminPassword){setIsAdmin(true);setModal(null);}else setMErr("비밀번호가 틀렸습니다");setMInput("");}}}
                placeholder="비밀번호 입력" style={miS} autoFocus/>
              {mErr&&<p style={{color:"#ef4444",fontSize:"12px",marginTop:"6px"}}>{mErr}</p>}
              <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"14px"}}>
                <button onClick={()=>{if(mInput===adminPassword){setIsAdmin(true);setModal(null);}else{setMErr("비밀번호가 틀렸습니다");setMInput("");}}} style={okBtnS}>확인</button>
                <button onClick={()=>{setModal(null);setMInput("");setMErr("");}} style={cxBtnS}>취소</button>
              </div>
            </>}
            {modal==="changePw"&&<>
              <div style={{fontSize:"26px",marginBottom:"6px"}}>🔑</div>
              <h3 style={{fontWeight:700,fontSize:"15px",marginBottom:"14px",color:"#1e293b"}}>비밀번호 변경</h3>
              <input type="password" value={mInput} onChange={e=>{setMInput(e.target.value);setMErr("");}} placeholder="현재 비밀번호" style={{...miS,marginBottom:"8px"}}/>
              <input type="password" value={mInput2} onChange={e=>setMInput2(e.target.value)} placeholder="새 비밀번호 (4자 이상)" style={miS}/>
              {mErr&&<p style={{color:"#ef4444",fontSize:"12px",marginTop:"6px"}}>{mErr}</p>}
              <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"14px"}}>
                <button onClick={()=>{
                  if(mInput!==adminPassword){setMErr("현재 비밀번호 틀림");return;}
                  if(mInput2.length<4){setMErr("4자 이상 입력");return;}
                  setAdminPassword(mInput2);setModal(null);setMInput("");setMInput2("");setMErr("");
                }} style={okBtnS}>변경</button>
                <button onClick={()=>{setModal(null);setMInput("");setMInput2("");setMErr("");}} style={cxBtnS}>취소</button>
              </div>
            </>}
            {modal==="saveVersion"&&<>
              <div style={{fontSize:"26px",marginBottom:"6px"}}>💾</div>
              <h3 style={{fontWeight:700,fontSize:"15px",marginBottom:"14px",color:"#1e293b"}}>버전 저장</h3>
              <input value={versionLabel} onChange={e=>setVersionLabel(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){saveVersion(versionLabel||`버전 ${versions.length+1}`);setVersionLabel("");setModal(null);}}}
                placeholder="버전 이름 (예: 2024년 1월)" style={miS} autoFocus/>
              <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"14px"}}>
                <button onClick={()=>{saveVersion(versionLabel||`버전 ${versions.length+1}`);setVersionLabel("");setModal(null);}} style={okBtnS}>저장</button>
                <button onClick={()=>{setModal(null);setVersionLabel("");}} style={cxBtnS}>취소</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* ══ 왼쪽 사이드바 ══ */}
      <div style={{width:"245px",backgroundColor:"#fff",padding:"14px",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",boxShadow:"2px 0 8px rgba(0,0,0,0.04)",overflowY:"auto"}}>
        {isAdmin
          ?<input value={appTitle} onChange={e=>setAppTitle(e.target.value)} style={{fontSize:"13px",fontWeight:800,border:"2px solid #2563eb",borderRadius:"8px",width:"100%",marginBottom:"10px",padding:"6px 8px",boxSizing:"border-box"}}/>
          :<h2 style={{fontWeight:800,fontSize:"13px",marginBottom:"10px",color:"#1e293b"}}>{appTitle}</h2>
        }

        {isAdmin&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"3px",marginBottom:"12px"}}>
            {([["floors","🏢 층/통계"],["versions","💾 버전"],["shortcuts","⌨️ 단축키"]] as [SideTab,string][]).map(([k,lbl])=>(
              <button key={k} onClick={()=>setSideTab(k)}
                style={{padding:"5px 0",fontSize:"10px",fontWeight:700,border:"none",borderRadius:"6px",cursor:"pointer",
                  backgroundColor:sideTab===k?"#2563eb":"#f1f5f9",color:sideTab===k?"#fff":"#64748b"}}>{lbl}</button>
            ))}
          </div>
        )}

        {/* 비관리자: 층만 */}
        {!isAdmin&&<>
          <span style={slS}>🏢 층 정보</span>
          {floors.map(f=>(
            <button key={f.id} onClick={()=>setActiveFloorId(f.id)}
              style={{width:"100%",padding:"7px 10px",marginBottom:"4px",backgroundColor:activeFloorId===f.id?"#2563eb":"#f8fafc",
                color:activeFloorId===f.id?"#fff":"#64748b",border:`1px solid ${activeFloorId===f.id?"#2563eb":"#e2e8f0"}`,
                borderRadius:"6px",cursor:"pointer",textAlign:"left",fontSize:"12px",fontWeight:600}}>
              {f.displayName}
            </button>
          ))}
        </>}

        {/* 관리자 층/통계 탭 */}
        {isAdmin&&sideTab==="floors"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <span style={slS}>🏢 층 정보</span>
            <button onClick={addFloor} style={{fontSize:"10px",padding:"2px 8px",backgroundColor:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"4px",cursor:"pointer",fontWeight:700}}>+ 추가</button>
          </div>
          {floors.map(f=>(
            <div key={f.id} style={{marginBottom:"4px",display:"flex",alignItems:"center",gap:"4px"}}>
              {editingFloorId===f.id
                ?<input autoFocus value={editingFloorName} onChange={e=>setEditingFloorName(e.target.value)}
                  onBlur={()=>{renameFloor(f.id,editingFloorName||f.displayName);setEditingFloorId(null);}}
                  onKeyDown={e=>{if(e.key==="Enter"){renameFloor(f.id,editingFloorName||f.displayName);setEditingFloorId(null);}}}
                  style={{flex:1,padding:"6px 8px",fontSize:"12px",border:"2px solid #2563eb",borderRadius:"6px",outline:"none"}}/>
                :<button onClick={()=>setActiveFloorId(f.id)} onDoubleClick={()=>{setEditingFloorId(f.id);setEditingFloorName(f.displayName);}}
                  style={{flex:1,padding:"7px 10px",backgroundColor:activeFloorId===f.id?"#2563eb":"#f8fafc",
                    color:activeFloorId===f.id?"#fff":"#64748b",border:`1px solid ${activeFloorId===f.id?"#2563eb":"#e2e8f0"}`,
                    borderRadius:"6px",cursor:"pointer",textAlign:"left",fontSize:"12px",fontWeight:600,position:"relative"}}>
                  {f.displayName}
                  <span style={{position:"absolute",right:"8px",top:"50%",transform:"translateY(-50%)",fontSize:"10px",opacity:0.7}}>{f.items.filter(i=>i.type==="seat").length}석</span>
                </button>
              }
              {floors.length>1&&<button onClick={()=>deleteFloor(f.id)}
                style={{width:"22px",height:"22px",padding:0,backgroundColor:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:"5px",cursor:"pointer",fontSize:"14px",lineHeight:1,flexShrink:0}}>×</button>}
            </div>
          ))}
          <p style={{fontSize:"10px",color:"#c0c8d6",marginTop:"2px",marginBottom:"12px"}}>더블클릭으로 층 이름 변경</p>

          <div style={{backgroundColor:"#f8fafc",borderRadius:"8px",padding:"10px",marginBottom:"10px",border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
              <span style={{fontSize:"11px",color:"#64748b"}}>🏢 전체</span>
              <span style={{fontSize:"13px",fontWeight:800,color:"#1e293b"}}>{allSeats.length}석</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
              <span style={{fontSize:"11px",color:"#64748b"}}>📍 {curFloor.displayName}</span>
              <span style={{fontSize:"13px",fontWeight:800,color:"#2563eb"}}>{curSeats.length}석</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:"11px",color:"#64748b"}}>⬜ 빈 좌석</span>
              <span style={{fontSize:"13px",fontWeight:800,color:"#f59e0b"}}>{emptySeats.length}석</span>
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <span style={slS}>부서별</span>
            <span style={{fontSize:"9px",color:"#c0c8d6"}}>색상클릭=선택</span>
          </div>
          {activeColorGroups.length===0
            ?<p style={{fontSize:"11px",color:"#c0c8d6",textAlign:"center",padding:"12px 0"}}>배치된 좌석 없음</p>
            :activeColorGroups.map((group,idx)=>(
              <div key={group.hex} draggable
                onDragStart={()=>{deptDragIdx.current=idx;}}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>{
                  if(deptDragIdx.current===null||deptDragIdx.current===idx)return;
                  const o=[...colorGroupOrder];const fromHex=activeColorGroups[deptDragIdx.current]?.hex;
                  if(!fromHex)return;const fi=o.indexOf(fromHex),ti=o.indexOf(group.hex);
                  if(fi===-1)return;const newO=[...o];newO.splice(fi,1);newO.splice(ti===-1?newO.length:ti,0,fromHex);
                  setColorGroupOrder(newO);deptDragIdx.current=null;
                }}
                style={{display:"flex",alignItems:"center",gap:"7px",padding:"7px 8px",backgroundColor:"#fafafa",border:"1px solid #f1f5f9",borderRadius:"7px",marginBottom:"4px",cursor:"grab"}}>
                <div onClick={()=>selectByColor(group.hex)}
                  style={{width:"16px",height:"16px",borderRadius:"50%",backgroundColor:group.hex,flexShrink:0,cursor:"pointer",border:"2px solid rgba(0,0,0,0.1)"}}/>
                {editingColorHex===group.hex
                  ?<input autoFocus value={group.name} onChange={e=>setColorGroupNames(p=>({...p,[group.hex]:e.target.value}))}
                    onBlur={()=>setEditingColorHex(null)} onKeyDown={e=>{if(e.key==="Enter")setEditingColorHex(null);}}
                    style={{flex:1,fontSize:"11px",border:"1px solid #2563eb",borderRadius:"4px",padding:"2px 4px",outline:"none"}}/>
                  :<span onDoubleClick={()=>setEditingColorHex(group.hex)}
                    style={{flex:1,fontSize:"11px",color:"#374151",fontWeight:600,cursor:"text"}}>{group.name}</span>
                }
                <span style={{fontSize:"10px",color:"#2563eb",fontWeight:700,minWidth:"18px",textAlign:"right"}}>{group.curCount}</span>
                <span style={{fontSize:"9px",color:"#c0c8d6"}}>/</span>
                <span style={{fontSize:"10px",color:"#374151",fontWeight:800,minWidth:"18px"}}>{group.totalCount}</span>
              </div>
            ))
          }
          {activeColorGroups.length>0&&<p style={{fontSize:"9px",color:"#c0c8d6",marginTop:"2px"}}>이름 더블클릭 변경 · 드래그 순서변경</p>}
        </>}

        {isAdmin&&sideTab==="versions"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <span style={slS}>💾 버전 히스토리</span>
            <button onClick={()=>setModal("saveVersion")} style={{fontSize:"10px",padding:"2px 8px",backgroundColor:"#f0fdf4",color:"#10b981",border:"1px solid #bbf7d0",borderRadius:"4px",cursor:"pointer",fontWeight:700}}>+ 저장</button>
          </div>
          {versions.length===0?<p style={{fontSize:"11px",color:"#c0c8d6",textAlign:"center",paddingTop:"20px"}}>저장된 버전 없음</p>
            :versions.map(v=>(
              <div key={v.id} style={{backgroundColor:"#fafafa",border:"1px solid #f1f5f9",borderRadius:"8px",padding:"9px 10px",marginBottom:"6px"}}>
                <div style={{fontWeight:700,fontSize:"12px",color:"#1e293b",marginBottom:"2px"}}>{v.label}</div>
                <div style={{fontSize:"10px",color:"#94a3b8",marginBottom:"7px"}}>{v.savedAt}</div>
                <div style={{display:"flex",gap:"5px"}}>
                  <button onClick={()=>restoreVersion(v)} style={{flex:1,padding:"5px",fontSize:"10px",backgroundColor:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"5px",cursor:"pointer",fontWeight:700}}>복구</button>
                  <button onClick={()=>deleteVersion(v.id)} style={{flex:1,padding:"5px",fontSize:"10px",backgroundColor:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:"5px",cursor:"pointer",fontWeight:700}}>삭제</button>
                </div>
              </div>
            ))
          }
        </>}

        {isAdmin&&sideTab==="shortcuts"&&<>
          <span style={slS}>⌨️ 단축키</span>
          {[["Ctrl+Z","되돌리기"],["Ctrl+D","복제"],["Ctrl+A","전체선택"],["Del","삭제"],["Esc","구역그리기 취소"],["←↑→↓","미세이동 1px"],["Shift+화살표","10px 이동"],["드래그(빈공간)","박스 다중선택"],["Shift+클릭","개별 추가선택"]].map(([k,d])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px"}}>
              <code style={{fontSize:"9px",backgroundColor:"#e2e8f0",padding:"2px 5px",borderRadius:"3px",color:"#475569"}}>{k}</code>
              <span style={{fontSize:"10px",color:"#94a3b8"}}>{d}</span>
            </div>
          ))}
        </>}

        <div style={{marginTop:"auto",paddingTop:"12px",display:"flex",flexDirection:"column",gap:"5px"}}>
          {isAdmin&&<>
            <button onClick={()=>addItem("seat")} style={addBtnS("#eff6ff","#2563eb","#dbeafe")}>🪑 좌석 추가</button>
            <button onClick={()=>addItem("wall")} style={addBtnS("#f8fafc","#475569","#e2e8f0")}>🧱 벽체 추가</button>
            <button onClick={()=>addItem("door")} style={addBtnS("#f8fafc","#64748b","#e2e8f0")}>🚪 문 추가</button>
            <button onClick={()=>{setZoneDrawMode(p=>!p);setSelectedIds([]);setSelectedZoneId(null);isZoneDrawing.current=false;setZoneDrawing(null);}}
              style={addBtnS(zoneDrawMode?"#fef9c3":"#fafafa",zoneDrawMode?"#b45309":"#64748b",zoneDrawMode?"#fde68a":"#e2e8f0")}>
              {zoneDrawMode?"✏️ 그리는 중... (Esc취소)":"🗂 구역 추가"}
            </button>
            <button onClick={()=>setModal("changePw")} style={{padding:"7px",backgroundColor:"#f8fafc",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:"7px",cursor:"pointer",fontSize:"11px",fontWeight:600}}>🔑 비밀번호 변경</button>
          </>}
          <button onClick={()=>isAdmin?setIsAdmin(false):setModal("login")}
            style={{padding:"9px",backgroundColor:isAdmin?"#1e293b":"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
            {isAdmin?"✅ 편집 종료":"🔐 관리자 로그인"}
          </button>
        </div>
      </div>

      {/* ══ 메인 캔버스 ══ */}
      <div style={{flex:1,padding:"16px",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",gap:"6px",alignItems:"center",marginBottom:"8px",flexWrap:"wrap"}}>
          {isAdmin&&<>
            <button onClick={()=>{if(undoHistory.length>0){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));} }} style={tbBtnS}>↩ 되돌리기</button>
            <button onClick={selectAll} style={tbBtnS}>☑ 전체선택</button>
            <button onClick={duplicateSelected} disabled={!selectedIds.length} style={{...tbBtnS,opacity:selectedIds.length?1:0.4}}>⿻ 복제</button>
            <button onClick={()=>setModal("saveVersion")} style={{...tbBtnS,backgroundColor:"#f0fdf4",color:"#10b981",border:"1px solid #d1fae5"}}>💾 버전저장</button>
            <div style={{width:"1px",height:"20px",backgroundColor:"#e2e8f0"}}/>
            <button onClick={()=>setEmptyHighlight(p=>!p)}
              style={{...tbBtnS,backgroundColor:emptyHighlight?"#fef9c3":"#fff",color:emptyHighlight?"#b45309":"#475569",border:emptyHighlight?"1px solid #fde68a":"1px solid #e2e8f0"}}>
              {emptyHighlight?"⬜ 빈자리 ON":"⬜ 빈자리"}
            </button>
            <button onClick={()=>setZoneVisible(p=>!p)}
              style={{...tbBtnS,backgroundColor:zoneVisible?"#eff6ff":"#fff",color:zoneVisible?"#2563eb":"#475569",border:zoneVisible?"1px solid #bfdbfe":"1px solid #e2e8f0"}}>
              {zoneVisible?"🗂 구역 ON":"🗂 구역"}
            </button>
            <button onClick={handleExport} style={{...tbBtnS,backgroundColor:"#f0fdf4",color:"#059669",border:"1px solid #d1fae5"}}>🖼 PNG</button>
            {overlappingIds.size>0&&<span style={{fontSize:"11px",color:"#ef4444",backgroundColor:"#fef2f2",padding:"4px 10px",borderRadius:"20px",border:"1px solid #fecaca"}}>⚠ {overlappingIds.size}개 겹침</span>}
            {zoneDrawMode&&<span style={{fontSize:"11px",color:"#b45309",backgroundColor:"#fef9c3",padding:"4px 10px",borderRadius:"20px",border:"1px solid #fde68a"}}>✏️ 드래그해서 구역 그리기</span>}
          </>}
        </div>

        {/* ★ canvasRef: overflow hidden 제거, position relative 유지 */}
        <div ref={canvasRef}
          style={{flex:1,borderRadius:"14px",border:"1px solid #e2e8f0",position:"relative",
            backgroundColor:"#fafafa",
            backgroundImage:"radial-gradient(#e2e8f0 1px, transparent 1px)",
            backgroundSize:"20px 20px",
            overflow:"hidden",
            cursor:zoneDrawMode?"crosshair":"default",
            userSelect:"none"}}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}>

          {/* 구역 (최하단 zIndex:1) — zoneVisible일 때만 표시 */}
          {zoneVisible&&curZones.map(zone=>(
            <div key={zone.id}
              data-zone="true"
              onClick={e=>{e.stopPropagation();if(isAdmin){setSelectedZoneId(zone.id);setSelectedIds([]);}}}
              style={{position:"absolute",left:zone.x,top:zone.y,width:zone.width,height:zone.height,
                backgroundColor:hexToRgba(zone.color,0.12),
                border:`2px ${isAdmin&&selectedZoneId===zone.id?"solid":"dashed"} ${zone.color}`,
                borderRadius:"8px",zIndex:1,cursor:isAdmin?"pointer":"default",boxSizing:"border-box"}}>
              <span style={{position:"absolute",top:"6px",left:"10px",fontSize:"11px",fontWeight:700,
                color:zone.color,userSelect:"none",pointerEvents:"none"}}>{zone.name}</span>
              {/* 크기 조절 핸들 */}
              {isAdmin&&selectedZoneId===zone.id&&(
                <div style={{position:"absolute",right:0,bottom:0,width:"14px",height:"14px",
                    backgroundColor:zone.color,borderRadius:"3px 0 8px 0",cursor:"se-resize",opacity:0.8}}
                  onMouseDown={e=>{
                    e.stopPropagation();e.preventDefault();
                    const startX=e.clientX,startY=e.clientY,startW=zone.width,startH=zone.height;
                    const onMove=(me:MouseEvent)=>{
                      updateZones(curZones.map(z=>z.id===zone.id?{...z,width:Math.max(60,startW+(me.clientX-startX)),height:Math.max(40,startH+(me.clientY-startY))}:z));
                    };
                    const onUp=()=>{saveHistory();window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
                    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
                  }}/>
              )}
              {/* 이동 핸들 */}
              {isAdmin&&selectedZoneId===zone.id&&(
                <div style={{position:"absolute",inset:0,cursor:"move"}}
                  onMouseDown={e=>{
                    e.stopPropagation();e.preventDefault();
                    const startX=e.clientX,startY=e.clientY,startZX=zone.x,startZY=zone.y;
                    const onMove=(me:MouseEvent)=>{
                      updateZones(curZones.map(z=>z.id===zone.id?{...z,x:startZX+(me.clientX-startX),y:startZY+(me.clientY-startY)}:z));
                    };
                    const onUp=()=>{saveHistory();window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
                    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
                  }}/>
              )}
            </div>
          ))}

          {/* 구역 드로잉 프리뷰 */}
          {zoneDrawing&&(
            <div style={{position:"absolute",pointerEvents:"none",
              left:Math.min(zoneDrawing.sx,zoneDrawing.ex),top:Math.min(zoneDrawing.sy,zoneDrawing.ey),
              width:Math.abs(zoneDrawing.ex-zoneDrawing.sx),height:Math.abs(zoneDrawing.ey-zoneDrawing.sy),
              border:"2px dashed #f59e0b",backgroundColor:"rgba(245,158,11,0.08)",
              borderRadius:"8px",zIndex:250}}/>
          )}

          {/* 스냅 가이드라인 */}
          {snapGuides.x!==undefined&&<div style={{position:"absolute",left:snapGuides.x,top:0,bottom:0,width:"1px",backgroundColor:"#2563eb",opacity:0.5,zIndex:200,pointerEvents:"none"}}/>}
          {snapGuides.y!==undefined&&<div style={{position:"absolute",top:snapGuides.y,left:0,right:0,height:"1px",backgroundColor:"#2563eb",opacity:0.5,zIndex:200,pointerEvents:"none"}}/>}

          {/* 박스 셀렉션 */}
          {boxSel&&<div style={{position:"absolute",pointerEvents:"none",
            left:Math.min(boxSel.sx,boxSel.ex),top:Math.min(boxSel.sy,boxSel.ey),
            width:Math.abs(boxSel.ex-boxSel.sx),height:Math.abs(boxSel.ey-boxSel.sy),
            border:"1.5px dashed #2563eb",backgroundColor:"rgba(37,99,235,0.05)",
            zIndex:300,borderRadius:"3px"}}/>}

          {/* ★ 좌석/벽/문 — data-item 속성 추가 */}
          {curItems.map(item=>{
            const isSel=selectedIds.includes(item.id);
            const isOv=overlappingIds.has(item.id);
            const isEmpty=item.type==="seat"&&(!item.name||item.name==="새 좌석"||item.name.trim()==="");
            const isEmptyHl=emptyHighlight&&isEmpty;
            const bgColor=isOv?"#fee2e2":isEmptyHl?"#fef9c3":applyOpacity(item.color,colorToOpacity(item.color));
            const borderColor=isSel?"#2563eb":isOv?"#ef4444":isEmptyHl?"#f59e0b":"rgba(0,0,0,0.08)";
            return (
              <Draggable key={item.id} position={{x:item.x,y:item.y}}
                onStart={(_e,_data)=>{
                  if(!isAdmin)return false;
                  if(!isSel)setSelectedIds([item.id]);
                  setSelectedZoneId(null);
                }}
                onDrag={(_e,data)=>{
                  const dx=data.x-item.x,dy=data.y-item.y;
                  const ids=isSel?selectedIds:[item.id];
                  const moved=curItems.map(i=>ids.includes(i.id)?{...i,x:i.x+dx,y:i.y+dy}:i);
                  const rep=moved.find(i=>i.id===item.id)!;
                  const others=moved.filter(i=>!ids.includes(i.id));
                  const sn=getSnapPosition(rep,others,rep.x,rep.y);
                  const sdx=sn.x-rep.x,sdy=sn.y-rep.y;
                  setSnapGuides({x:sn.snappedX?sn.x:undefined,y:sn.snappedY?sn.y:undefined});
                  updateItems(moved.map(i=>ids.includes(i.id)?{...i,x:i.x+sdx,y:i.y+sdy}:i));
                }}
                onStop={()=>{saveHistory();setSnapGuides({});}}
                disabled={!isAdmin}>
                {/* ★ data-item 속성: 이 요소 위 클릭/드래그를 구분하는 데 사용 */}
                <div data-item="true"
                  style={{position:"absolute",zIndex:isSel?100:10,cursor:isAdmin?"grab":"default"}}
                  onClick={e=>{
                    if(!isAdmin)return;
                    e.stopPropagation();
                    if(e.shiftKey)setSelectedIds(p=>p.includes(item.id)?p.filter(id=>id!==item.id):[...p,item.id]);
                    else{setSelectedIds([item.id]);setSelectedZoneId(null);}
                  }}>
                  {item.type==="door"
                    ?<DoorShape w={item.width} h={item.height} color={item.color} rotation={item.rotation} name={item.name} isSelected={isSel}/>
                    :<div style={{
                        transform:`rotate(${item.rotation}deg)`,
                        width:item.width,height:item.height,
                        backgroundColor:bgColor,
                        border:`${isSel||isOv||isEmptyHl?"2":"1"}px solid ${borderColor}`,
                        borderRadius:item.type==="wall"?"3px":"7px",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:isOv?"#ef4444":isEmptyHl?"#b45309":item.textColor,
                        fontSize:"11px",fontWeight:700,textAlign:"center",
                        boxShadow:isSel?"0 0 0 3px rgba(37,99,235,0.2)":isOv?"0 0 0 3px rgba(239,68,68,0.2)":isEmptyHl?"0 0 0 2px rgba(245,158,11,0.3)":"0 1px 3px rgba(0,0,0,0.06)",
                        userSelect:"none",
                      }}>
                        {isEmptyHl&&!item.name?"빈자리":item.name}
                      </div>
                  }
                </div>
              </Draggable>
            );
          })}
        </div>
      </div>

      {/* ══ 우측 속성 패널 ══ */}
      {isAdmin&&(
        <div style={{width:"230px",backgroundColor:"#fff",padding:"14px",borderLeft:"1px solid #e2e8f0",overflowY:"auto",boxShadow:"-2px 0 8px rgba(0,0,0,0.04)"}}>
          {selZone&&selectedIds.length===0?(
            <div>
              <div style={pcS}>
                <div style={slS}>🗂 구역 설정</div>
                <input value={selZone.name}
                  onChange={e=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,name:e.target.value}:z))}
                  style={inS} placeholder="구역 이름"/>
                {/* 크기 직접 입력 */}
                <div style={{display:"flex",gap:"4px",marginTop:"8px"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>너비(W)</div>
                    <input type="number" value={Math.round(selZone.width)}
                      onChange={e=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,width:Math.max(60,+e.target.value)}:z))}
                      style={inS}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>높이(H)</div>
                    <input type="number" value={Math.round(selZone.height)}
                      onChange={e=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,height:Math.max(40,+e.target.value)}:z))}
                      style={inS}/>
                  </div>
                </div>
                <div style={{fontSize:"9px",color:"#c0c8d6",marginTop:"4px"}}>구역 우하단 핸들로도 크기 조절 가능</div>
                {/* 색상 */}
                <div style={{marginTop:"10px",display:"flex",gap:"5px",flexWrap:"wrap"}}>
                  {["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#64748b","#ec4899"].map(c=>(
                    <div key={c} onClick={()=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,color:c}:z))}
                      style={{width:"20px",height:"20px",borderRadius:"50%",backgroundColor:c,cursor:"pointer",
                        border:selZone.color===c?"2.5px solid #1e293b":"2px solid transparent",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                  ))}
                </div>
              </div>
              <button onClick={()=>{saveHistory();updateZones(curZones.filter(z=>z.id!==selZone.id));setSelectedZoneId(null);}}
                style={{width:"100%",padding:"8px",border:"1px solid #fecaca",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#fef2f2",color:"#ef4444",fontWeight:700}}>🗑 구역 삭제</button>
            </div>
          ):selItems.length===0?(
            <div style={{textAlign:"center",color:"#94a3b8",fontSize:"12px",paddingTop:"40px"}}>
              <div style={{fontSize:"30px",marginBottom:"10px"}}>👆</div>
              좌석을 클릭하거나<br/>드래그로 다중선택
            </div>
          ):(
            <>
              <div style={pcS}>
                <div style={slS}>📌 선택 정보</div>
                <div style={{fontSize:"12px",color:"#64748b"}}>{selItems.length===1?selItems[0].name:`${selItems.length}개 선택됨`}</div>
              </div>

              {selItems.length===1&&<div style={pcS}>
                <div style={slS}>✏️ 이름 / 크기</div>
                <input value={selItems[0].name} onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,name:e.target.value}:i))} style={inS} placeholder="이름"/>
                <div style={{display:"flex",gap:"4px",marginTop:"6px"}}>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>너비(W)</div>
                    <input type="number" value={selItems[0].width} onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,width:+e.target.value}:i))} style={inS}/></div>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>높이(H)</div>
                    <input type="number" value={selItems[0].height} onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,height:+e.target.value}:i))} style={inS}/></div>
                </div>
              </div>}

              <div style={pcS}>
                <div style={slS}>🎨 배경색 · 투명도</div>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"8px"}}>
                  {departments.map(d=>(
                    <div key={d.id} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(d.color,colorToOpacity(i.color))}:i))}
                      title={d.name}
                      style={{width:"20px",height:"20px",borderRadius:"50%",backgroundColor:d.color,cursor:"pointer",
                        border:colorToHex(selItems[0]?.color)===d.color?"2.5px solid #1e293b":"2px solid transparent",
                        boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                  ))}
                  {customPalette.map((c,ci)=>(
                    <div key={ci} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(c,colorToOpacity(i.color))}:i))}
                      style={{width:"20px",height:"20px",borderRadius:"50%",backgroundColor:c,cursor:"pointer",border:"2px solid transparent",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                  ))}
                  <div onClick={()=>pickRef.current?.click()} title="커스텀 색상"
                    style={{width:"20px",height:"20px",borderRadius:"50%",cursor:"pointer",
                      background:"conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
                      border:"2px solid rgba(0,0,0,0.12)",boxShadow:"0 1px 3px rgba(0,0,0,0.18)",position:"relative"}}>
                    <input ref={pickRef} type="color" value={pickColor} onChange={e=>setPickColor(e.target.value)}
                      style={{opacity:0,width:0,height:0,position:"absolute",pointerEvents:"none"}}/>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px",padding:"6px 8px",backgroundColor:"#f8fafc",borderRadius:"7px",border:"1px solid #f1f5f9"}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"50%",backgroundColor:pickColor,border:"2px solid #e2e8f0",flexShrink:0}}/>
                  <code style={{fontSize:"9px",color:"#64748b",flex:1}}>{pickColor}</code>
                  <button onClick={()=>{
                    updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(pickColor,colorToOpacity(i.color))}:i));
                    if(!customPalette.includes(pickColor)&&customPalette.length<10)setCustomPalette(p=>[...p,pickColor]);
                  }} style={{fontSize:"10px",padding:"4px 8px",backgroundColor:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"5px",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>적용</button>
                </div>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                    <span style={{fontSize:"10px",color:"#94a3b8"}}>투명도</span>
                    <span style={{fontSize:"10px",color:"#64748b",fontWeight:700}}>{Math.round(colorToOpacity(selItems[0]?.color??"")*100)}%</span>
                  </div>
                  <input type="range" min={0.1} max={1} step={0.05}
                    value={colorToOpacity(selItems[0]?.color??"")}
                    onChange={e=>{const op=+e.target.value;updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(colorToHex(i.color),op)}:i));}}
                    style={{width:"100%",accentColor:"#2563eb"}}/>
                </div>
              </div>

              <div style={pcS}>
                <div style={slS}>🖋 글자색</div>
                <EyedropperPicker value={selItems[0]?.textColor??"#ffffff"}
                  onChange={v=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,textColor:v}:i))} label="글자색"/>
              </div>

              <div style={pcS}>
                <div style={slS}>🔄 회전</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"6px"}}>
                  {([["←90°",-90],["90°→",90],["45°→",45],["180°",180]] as [string,number][]).map(([lbl,deg])=>(
                    <button key={lbl} onClick={()=>rotateObjects(deg)}
                      style={{padding:"7px 4px",border:"1px solid #e2e8f0",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#f0f9ff",fontWeight:600,color:"#374151"}}>{lbl}</button>
                  ))}
                </div>
                {selItems.length===1&&<div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                  <span style={{fontSize:"10px",color:"#94a3b8"}}>각도</span>
                  <input type="number" value={selItems[0].rotation}
                    onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,rotation:((+e.target.value)%360+360)%360}:i))}
                    style={{...inS,width:"60px"}}/>
                  <span style={{fontSize:"10px",color:"#94a3b8"}}>°</span>
                  <button onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,rotation:0}:i))}
                    style={{fontSize:"10px",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:"4px",cursor:"pointer",backgroundColor:"#f8fafc",color:"#64748b"}}>리셋</button>
                </div>}
              </div>

              <div style={pcS}>
                <div style={slS}>📐 정렬 {selItems.length<2&&<span style={{color:"#fbbf24",fontSize:"9px"}}>(2개↑)</span>}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",marginBottom:"5px"}}>
                  {([["⬅","left"],["↔","centerV"],["➡","right"],["⬆","top"],["↕","centerH"],["⬇","bottom"]] as [string,Parameters<typeof alignObjects>[0]][]).map(([icon,t])=>(
                    <button key={t} onClick={()=>alignObjects(t)} disabled={selItems.length<2}
                      style={{padding:"7px 4px",border:"1px solid #e2e8f0",borderRadius:"5px",fontSize:"14px",
                        cursor:selItems.length>=2?"pointer":"not-allowed",backgroundColor:selItems.length>=2?"#f8fafc":"#f1f5f9",opacity:selItems.length>=2?1:0.35}}>{icon}</button>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
                  <button onClick={()=>alignObjects("distributeH")} disabled={selItems.length<3}
                    style={{padding:"6px",fontSize:"10px",border:"1px solid #e2e8f0",borderRadius:"5px",cursor:selItems.length>=3?"pointer":"not-allowed",backgroundColor:"#f8fafc",opacity:selItems.length>=3?1:0.35,fontWeight:600}}>↔ 균등</button>
                  <button onClick={()=>alignObjects("distributeV")} disabled={selItems.length<3}
                    style={{padding:"6px",fontSize:"10px",border:"1px solid #e2e8f0",borderRadius:"5px",cursor:selItems.length>=3?"pointer":"not-allowed",backgroundColor:"#f8fafc",opacity:selItems.length>=3?1:0.35,fontWeight:600}}>↕ 균등</button>
                </div>
              </div>

              <div style={pcS}>
                <div style={slS}>🛠 편집</div>
                <button onClick={duplicateSelected}
                  style={{width:"100%",padding:"8px",border:"1px solid #d1fae5",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#ecfdf5",color:"#10b981",fontWeight:700,marginBottom:"5px"}}>⿻ 복제 (Ctrl+D)</button>
                <button onClick={()=>{saveHistory();updateItems(curItems.filter(i=>!selectedIds.includes(i.id)));setSelectedIds([]);}}
                  style={{width:"100%",padding:"8px",border:"1px solid #fecaca",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#fef2f2",color:"#ef4444",fontWeight:700}}>🗑 삭제 (Del)</button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

const miS: React.CSSProperties={width:"100%",padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
const okBtnS: React.CSSProperties={padding:"10px 24px",backgroundColor:"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:700};
const cxBtnS: React.CSSProperties={padding:"10px 24px",border:"1px solid #e2e8f0",borderRadius:"8px",cursor:"pointer",fontSize:"13px",color:"#64748b",backgroundColor:"#f8fafc"};
const addBtnS=(bg:string,color:string,border:string): React.CSSProperties=>({width:"100%",padding:"8px 12px",backgroundColor:bg,color,border:`1px solid ${border}`,borderRadius:"8px",fontWeight:700,cursor:"pointer",fontSize:"12px",marginBottom:"4px",textAlign:"left"});
const pcS: React.CSSProperties={padding:"11px",border:"1px solid #f1f5f9",borderRadius:"10px",marginBottom:"8px",backgroundColor:"#fafafa"};
const slS: React.CSSProperties={fontSize:"10px",color:"#94a3b8",display:"block",marginBottom:"7px",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.5px"};
const inS: React.CSSProperties={width:"100%",padding:"6px 8px",border:"1px solid #e2e8f0",borderRadius:"6px",fontSize:"12px",boxSizing:"border-box" as const,outline:"none",backgroundColor:"#fff"};
const tbBtnS: React.CSSProperties={padding:"6px 12px",backgroundColor:"#fff",border:"1px solid #e2e8f0",borderRadius:"20px",cursor:"pointer",fontSize:"11px",fontWeight:600,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",color:"#475569"};
