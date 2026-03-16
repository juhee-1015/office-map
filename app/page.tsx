"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Draggable from "react-draggable";

// ─── 타입 ───────────────────────────────────────────────
type ItemType = "seat" | "wall" | "door";
interface RoomItem {
  id: number; type: ItemType; name: string; rotation: number;
  color: string; textColor: string; opacity: number; textOpacity: number;
  width: number; height: number; x: number; y: number;
}
interface FloorInfo { id: string; displayName: string; items: RoomItem[]; }
interface Department { id: string; name: string; color: string; }
interface VersionSnapshot { id: string; label: string; savedAt: string; floors: FloorInfo[]; }

// ─── 색상 유틸 ──────────────────────────────────────────
function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
function rgbaToHexOpacity(rgba: string): { hex: string; opacity: number } {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { hex: rgba.startsWith("#") ? rgba : "#3b82f6", opacity: 1 };
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return { hex: `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`, opacity: m[4] !== undefined ? +m[4] : 1 };
}
function colorToHex(c: string): string {
  if (c.startsWith("#")) return c;
  if (c.startsWith("rgba")||c.startsWith("rgb")) return rgbaToHexOpacity(c).hex;
  return c;
}
function colorToOpacity(c: string): number {
  if (c.startsWith("rgba")) return rgbaToHexOpacity(c).opacity;
  return 1;
}
function applyOpacity(color: string, opacity: number): string {
  return hexToRgba(colorToHex(color), opacity);
}

// ─── 스냅 상수 ──────────────────────────────────────────
const SNAP_THRESHOLD = 10;
const GRID_SIZE = 10;
const GAP = 1; // 좌석간 최소 간격 (거의 붙도록)

function getSnapPosition(dragging: RoomItem, others: RoomItem[], rawX: number, rawY: number) {
  let bestX = rawX, bestY = rawY;
  let snapDistX = SNAP_THRESHOLD + 1, snapDistY = SNAP_THRESHOLD + 1;
  const dL=rawX, dR=rawX+dragging.width, dT=rawY, dB=rawY+dragging.height;
  const dCX=rawX+dragging.width/2, dCY=rawY+dragging.height/2;
  for (const o of others) {
    if (o.id===dragging.id) continue;
    const oL=o.x, oR=o.x+o.width, oT=o.y, oB=o.y+o.height;
    const oCX=o.x+o.width/2, oCY=o.y+o.height/2;
    const xC=[{drag:dL,target:oL},{drag:dL,target:oR+GAP},{drag:dR,target:oR},{drag:dR,target:oL-GAP},{drag:dCX,target:oCX}];
    for (const c of xC){const d=Math.abs(c.drag-c.target);if(d<snapDistX){snapDistX=d;bestX=rawX+(c.target-c.drag);}}
    const yC=[{drag:dT,target:oT},{drag:dT,target:oB+GAP},{drag:dB,target:oB},{drag:dB,target:oT-GAP},{drag:dCY,target:oCY}];
    for (const c of yC){const d=Math.abs(c.drag-c.target);if(d<snapDistY){snapDistY=d;bestY=rawY+(c.target-c.drag);}}
  }
  if (snapDistX>SNAP_THRESHOLD) bestX=Math.round(rawX/GRID_SIZE)*GRID_SIZE;
  if (snapDistY>SNAP_THRESHOLD) bestY=Math.round(rawY/GRID_SIZE)*GRID_SIZE;
  return {x:bestX,y:bestY,snappedX:snapDistX<=SNAP_THRESHOLD,snappedY:snapDistY<=SNAP_THRESHOLD};
}

function isOverlapping(a: RoomItem, b: RoomItem): boolean {
  if (a.id===b.id) return false;
  const m=1;
  return a.x<b.x+b.width-m&&a.x+a.width>b.x+m&&a.y<b.y+b.height-m&&a.y+a.height>b.y+m;
}

// ─── 출입문 - 심플 박스 스타일 ──────────────────────────
function DoorShape({ w, h, rotation, name, isSelected }: {
  w:number; h:number; color:string; rotation:number; name:string; isSelected:boolean;
}) {
  return (
    <div style={{
      transform:`rotate(${rotation}deg)`, width:w, height:h,
      backgroundColor:"#fff",
      border: isSelected ? "2px solid #2563eb" : "2px dashed #94a3b8",
      borderRadius:"5px", cursor:"grab", display:"flex",
      alignItems:"center", justifyContent:"center",
      boxShadow: isSelected ? "0 0 0 3px rgba(37,99,235,0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
      userSelect:"none",
    }}>
      <span style={{fontSize:"11px", fontWeight:700, color:"#64748b", textAlign:"center", lineHeight:1.2}}>
        {name||"출입문"}
      </span>
    </div>
  );
}

// ─── 스포이드 컬러 피커 ──────────────────────────────────
function EyedropperPicker({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
      <span style={{fontSize:"10px",color:"#94a3b8",width:"45px",flexShrink:0}}>{label}</span>
      <div onClick={()=>ref.current?.click()} title="클릭해서 색상 선택"
        style={{width:"22px",height:"22px",borderRadius:"50%",backgroundColor:value,border:"2px solid #e2e8f0",cursor:"pointer",flexShrink:0}}/>
      <input ref={ref} type="color" value={colorToHex(value)}
        onChange={e=>onChange(hexToRgba(e.target.value,colorToOpacity(value)))}
        style={{opacity:0,width:0,height:0,position:"absolute"}}/>
      <code style={{fontSize:"9px",color:"#64748b",backgroundColor:"#f1f5f9",padding:"2px 5px",borderRadius:"3px"}}>{colorToHex(value)}</code>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────
export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState("사무실 좌석 배치도");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");

  const [floors, setFloors] = useState<FloorInfo[]>([{id:"F1",displayName:"1층",items:[]}]);
  const [activeFloorId, setActiveFloorId] = useState("F1");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [undoHistory, setUndoHistory] = useState<FloorInfo[][]>([]);

  // 부서 관련 — 기존 departments는 우측 패널 색상 팔레트용으로만 유지
  const [departments] = useState<Department[]>([
    {id:"d1",name:"기획",color:"#3b82f6"},{id:"d2",name:"개발",color:"#10b981"},
    {id:"d3",name:"디자인",color:"#8b5cf6"},{id:"d4",name:"영업",color:"#f59e0b"},
    {id:"d5",name:"인사",color:"#ef4444"},{id:"d6",name:"재무",color:"#06b6d4"},
    {id:"d7",name:"기타",color:"#64748b"},
  ]);

  // 색상 그룹 기반 통계 (실제 사용된 색상만 자동 등록)
  const [colorGroupNames, setColorGroupNames] = useState<Record<string,string>>({});
  const [colorGroupOrder, setColorGroupOrder] = useState<string[]>([]);
  const [editingColorHex, setEditingColorHex] = useState<string|null>(null);
  const deptDragIdx = useRef<number|null>(null);

  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [versionLabel, setVersionLabel] = useState("");

  const [customPalette, setCustomPalette] = useState<string[]>([]);
  const [pickColor, setPickColor] = useState("#ff6b6b");
  const pickRef = useRef<HTMLInputElement>(null);

  const [snapGuides, setSnapGuides] = useState<{x?:number;y?:number}>({});
  const [overlappingIds, setOverlappingIds] = useState<Set<number>>(new Set());

  type ModalT = "login"|"changePw"|"saveVersion"|null;
  const [modal, setModal] = useState<ModalT>(null);
  const [mInput, setMInput] = useState("");
  const [mInput2, setMInput2] = useState("");
  const [mErr, setMErr] = useState("");

  const [editingFloorId, setEditingFloorId] = useState<string|null>(null);
  const [editingFloorName, setEditingFloorName] = useState("");

  const [boxSel, setBoxSel] = useState<{sx:number;sy:number;ex:number;ey:number}|null>(null);
  const isBoxing = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  type SideTab = "floors"|"versions"|"shortcuts";
  const [sideTab, setSideTab] = useState<SideTab>("floors");

  useEffect(()=>{setHasMounted(true);},[]);

  const curFloor = useMemo(()=>floors.find(f=>f.id===activeFloorId)||floors[0],[floors,activeFloorId]);
  const curItems = curFloor.items;
  const selItems = useMemo(()=>curItems.filter(i=>selectedIds.includes(i.id)),[curItems,selectedIds]);
  const allSeats = useMemo(()=>floors.flatMap(f=>f.items.filter(i=>i.type==="seat")),[floors]);
  const curSeats = curItems.filter(i=>i.type==="seat");

  // 실제 배치된 색상만 추출하여 그룹 생성
  const activeColorGroups = useMemo(()=>{
    const hexSet = new Set<string>();
    allSeats.forEach(s=>hexSet.add(colorToHex(s.color)));
    // 새 색상 자동 등록
    hexSet.forEach(hex=>{
      if(!colorGroupNames[hex]){
        const preset = departments.find(d=>d.color===hex);
        // 이름 없으면 나중에 setColorGroupNames로 등록 (useMemo 안에서 set 불가 → useEffect로 처리)
      }
    });
    const hexList = Array.from(hexSet);
    // colorGroupOrder 기준으로 정렬, 없는건 뒤에
    const ordered = [
      ...colorGroupOrder.filter(h=>hexList.includes(h)),
      ...hexList.filter(h=>!colorGroupOrder.includes(h)),
    ];
    return ordered.map(hex=>({
      hex,
      name: colorGroupNames[hex] || departments.find(d=>d.color===hex)?.name || hex,
      totalCount: allSeats.filter(s=>colorToHex(s.color)===hex).length,
      curCount: curSeats.filter(s=>colorToHex(s.color)===hex).length,
    }));
  },[allSeats,curSeats,colorGroupNames,colorGroupOrder,departments]);

  // 새 색상이 등장하면 colorGroupOrder에 자동 추가
  useEffect(()=>{
    const hexSet = new Set(allSeats.map(s=>colorToHex(s.color)));
    setColorGroupOrder(prev=>{
      const newHexes=Array.from(hexSet).filter(h=>!prev.includes(h));
      return newHexes.length>0?[...prev,...newHexes]:prev;
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

  const addItem=(type:ItemType)=>{
    saveHistory();
    const id=Date.now();
    const col=type==="seat"?departments[0].color:type==="wall"?"#475569":"#10b981";
    const ni:RoomItem={id,type,name:type==="seat"?"새 좌석":type==="wall"?"":"출입문",
      rotation:0,color:col,textColor:"#ffffff",opacity:1,textOpacity:1,
      width:type==="wall"?150:type==="door"?60:50,height:type==="wall"?12:50,x:130,y:130};
    updateItems([...curItems,ni]);setSelectedIds([id]);
  };

  const addFloor=()=>{
    const id=`F${Date.now()}`;
    setFloors(p=>[...p,{id,displayName:`${p.length+1}층`,items:[]}]);
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
      const s=[...selItems].sort((a,b)=>a.x-b.x);
      const tw=s.reduce((a,i)=>a+i.width,0),ts=s[s.length-1].x+s[s.length-1].width-s[0].x-tw;
      const gap=ts/(s.length-1);let cx=s[0].x;const pm:Record<number,number>={};
      s.forEach(i=>{pm[i.id]=cx;cx+=i.width+gap;});
      ni=ni.map(i=>selectedIds.includes(i.id)?{...i,x:pm[i.id]??i.x}:i);
    } else if(type==="distributeV"){
      const s=[...selItems].sort((a,b)=>a.y-b.y);
      const th=s.reduce((a,i)=>a+i.height,0),ts=s[s.length-1].y+s[s.length-1].height-s[0].y-th;
      const gap=ts/(s.length-1);let cy=s[0].y;const pm:Record<number,number>={};
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

  const handleCanvasMouseDown=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(e.target!==canvasRef.current)return;
    if(!isAdmin){setSelectedIds([]);return;}
    const rect=canvasRef.current!.getBoundingClientRect();
    isBoxing.current=true;
    const sx=e.clientX-rect.left,sy=e.clientY-rect.top;
    setBoxSel({sx,sy,ex:sx,ey:sy});setSelectedIds([]);
  };
  const handleCanvasMouseMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(!isBoxing.current||!canvasRef.current)return;
    const rect=canvasRef.current.getBoundingClientRect();
    setBoxSel(p=>p?{...p,ex:e.clientX-rect.left,ey:e.clientY-rect.top}:null);
  };
  const handleCanvasMouseUp=()=>{
    if(!isBoxing.current||!boxSel){isBoxing.current=false;return;}
    isBoxing.current=false;
    const sl=Math.min(boxSel.sx,boxSel.ex),sr=Math.max(boxSel.sx,boxSel.ex);
    const st=Math.min(boxSel.sy,boxSel.ey),sb=Math.max(boxSel.sy,boxSel.ey);
    if(sr-sl>5&&sb-st>5)setSelectedIds(curItems.filter(i=>i.x<sr&&i.x+i.width>sl&&i.y<sb&&i.y+i.height>st).map(i=>i.id));
    setBoxSel(null);
  };

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(!isAdmin)return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();if(undoHistory.length>0){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));}}
      if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();duplicateSelected();}
      if((e.ctrlKey||e.metaKey)&&e.key==="a"){e.preventDefault();selectAll();}
      if((e.key==="Delete"||e.key==="Backspace")&&selectedIds.length&&document.activeElement?.tagName!=="INPUT"){
        saveHistory();updateItems(curItems.filter(i=>!selectedIds.includes(i.id)));setSelectedIds([]);
      }
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selectedIds.length&&document.activeElement?.tagName!=="INPUT"){
        e.preventDefault();const step=e.shiftKey?10:1;
        const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0;
        const dy=e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0;
        updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,x:i.x+dx,y:i.y+dy}:i));
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[isAdmin,undoHistory,selectedIds,curItems,duplicateSelected,saveHistory,updateItems]);

  if(!hasMounted)return null;

  return (
    <main style={{display:"flex",height:"100vh",backgroundColor:"#f1f5f9",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif"}}>

      {/* ══════ 모달 ══════ */}
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
                  if(mInput!==adminPassword){setMErr("현재 비밀번호가 틀렸습니다");return;}
                  if(mInput2.length<4){setMErr("새 비밀번호는 4자 이상이어야 합니다");return;}
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

      {/* ══════ 왼쪽 사이드바 ══════ */}
      <div style={{width:"245px",backgroundColor:"#fff",padding:"14px",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",boxShadow:"2px 0 8px rgba(0,0,0,0.04)",overflowY:"auto"}}>
        {isAdmin
          ?<input value={appTitle} onChange={e=>setAppTitle(e.target.value)} style={{fontSize:"13px",fontWeight:800,border:"2px solid #2563eb",borderRadius:"8px",width:"100%",marginBottom:"10px",padding:"6px 8px",boxSizing:"border-box"}}/>
          :<h2 style={{fontWeight:800,fontSize:"13px",marginBottom:"10px",color:"#1e293b",letterSpacing:"-0.3px"}}>{appTitle}</h2>
        }

        {/* 탭 — 관리자일 때만 버전/단축키 탭 표시 */}
        {isAdmin && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px",marginBottom:"12px"}}>
            {([ ["versions","💾 버전"],["shortcuts","⌨️ 단축키"] ] as [SideTab,string][]).map(([k,lbl])=>(
              <button key={k} onClick={()=>setSideTab(p=>p===k?"floors":k)}
                style={{padding:"5px 0",fontSize:"10px",fontWeight:700,border:"none",borderRadius:"6px",cursor:"pointer",backgroundColor:sideTab===k?"#2563eb":"#f1f5f9",color:sideTab===k?"#fff":"#64748b"}}>
                {lbl}
              </button>
            ))}
          </div>
        )}

        {/* ── 층 정보 — 항상 표시 ── */}
        {(sideTab==="floors"||!isAdmin)&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <span style={slS}>🏢 층 정보</span>
            {isAdmin&&<button onClick={addFloor} style={{fontSize:"10px",padding:"2px 8px",backgroundColor:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"4px",cursor:"pointer",fontWeight:700}}>+ 추가</button>}
          </div>
          {floors.map(f=>(
            <div key={f.id} style={{marginBottom:"4px",display:"flex",alignItems:"center",gap:"4px"}}>
              {editingFloorId===f.id&&isAdmin
                ?<input autoFocus value={editingFloorName}
                  onChange={e=>setEditingFloorName(e.target.value)}
                  onBlur={()=>{renameFloor(f.id,editingFloorName||f.displayName);setEditingFloorId(null);}}
                  onKeyDown={e=>{if(e.key==="Enter"){renameFloor(f.id,editingFloorName||f.displayName);setEditingFloorId(null);}}}
                  style={{flex:1,padding:"6px 8px",fontSize:"12px",border:"2px solid #2563eb",borderRadius:"6px",outline:"none"}}/>
                :<button onClick={()=>setActiveFloorId(f.id)}
                  onDoubleClick={()=>{if(!isAdmin)return;setEditingFloorId(f.id);setEditingFloorName(f.displayName);}}
                  style={{flex:1,padding:"7px 10px",backgroundColor:activeFloorId===f.id?"#2563eb":"#f8fafc",color:activeFloorId===f.id?"#fff":"#64748b",border:`1px solid ${activeFloorId===f.id?"#2563eb":"#e2e8f0"}`,borderRadius:"6px",cursor:"pointer",textAlign:"left",fontSize:"12px",fontWeight:600,position:"relative"}}>
                  {f.displayName}
                  <span style={{position:"absolute",right:"8px",top:"50%",transform:"translateY(-50%)",fontSize:"10px",opacity:0.7}}>{f.items.filter(i=>i.type==="seat").length}석</span>
                </button>
              }
              {isAdmin&&floors.length>1&&<button onClick={()=>deleteFloor(f.id)} style={{width:"22px",height:"22px",padding:0,backgroundColor:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:"5px",cursor:"pointer",fontSize:"14px",lineHeight:1,flexShrink:0}}>×</button>}
            </div>
          ))}
          {isAdmin&&<p style={{fontSize:"10px",color:"#c0c8d6",marginTop:"2px",marginBottom:"12px"}}>더블클릭으로 층 이름 변경</p>}

          {/* ── 좌석 통계 — 층 아래에 항상 표시 ── */}
          <div style={{backgroundColor:"#f8fafc",borderRadius:"8px",padding:"10px",marginBottom:"10px",border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
              <span style={{fontSize:"11px",color:"#64748b"}}>🏢 전체</span>
              <span style={{fontSize:"13px",fontWeight:800,color:"#1e293b"}}>{allSeats.length}석</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:"11px",color:"#64748b"}}>📍 {curFloor.displayName}</span>
              <span style={{fontSize:"13px",fontWeight:800,color:"#2563eb"}}>{curSeats.length}석</span>
            </div>
          </div>

          {/* 부서별 — 실제 사용 중인 색상만 + 미분류 색상도 자동 추가 */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <span style={slS}>부서별</span>
            {isAdmin&&<span style={{fontSize:"9px",color:"#c0c8d6"}}>색상클릭=선택</span>}
          </div>
          {activeColorGroups.length===0
            ?<p style={{fontSize:"11px",color:"#c0c8d6",textAlign:"center",padding:"12px 0"}}>배치된 좌석 없음</p>
            :activeColorGroups.map((group,idx)=>(
              <div key={group.hex} draggable={isAdmin}
                onDragStart={()=>{deptDragIdx.current=idx;}}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>{
                  if(!isAdmin||deptDragIdx.current===null||deptDragIdx.current===idx)return;
                  // 드래그 순서 변경: colorGroupOrder
                  const o=[...colorGroupOrder];
                  if(!o.includes(group.hex)){return;}
                  const fromHex=activeColorGroups[deptDragIdx.current]?.hex;
                  if(!fromHex)return;
                  const fi=o.indexOf(fromHex),ti=o.indexOf(group.hex);
                  if(fi===-1||ti===-1)return;
                  const newO=[...o];newO.splice(fi,1);newO.splice(ti,0,fromHex);
                  setColorGroupOrder(newO);deptDragIdx.current=null;
                }}
                style={{display:"flex",alignItems:"center",gap:"7px",padding:"7px 8px",backgroundColor:"#fafafa",border:"1px solid #f1f5f9",borderRadius:"7px",marginBottom:"4px",cursor:isAdmin?"grab":"default"}}>
                {/* 색상 동그라미 클릭 = 현재 층에서 해당 색상 좌석 선택 */}
                <div onClick={()=>selectByColor(group.hex)}
                  style={{width:"16px",height:"16px",borderRadius:"50%",backgroundColor:group.hex,flexShrink:0,cursor:"pointer",border:"2px solid rgba(0,0,0,0.1)"}}
                  title="클릭 → 현재 층 해당 좌석 전체선택"/>
                {/* 부서명 - 더블클릭 수정 */}
                {editingColorHex===group.hex&&isAdmin
                  ?<input autoFocus value={group.name}
                    onChange={e=>setColorGroupNames(p=>({...p,[group.hex]:e.target.value}))}
                    onBlur={()=>setEditingColorHex(null)}
                    onKeyDown={e=>{if(e.key==="Enter")setEditingColorHex(null);}}
                    style={{flex:1,fontSize:"11px",border:"1px solid #2563eb",borderRadius:"4px",padding:"2px 4px",outline:"none"}}/>
                  :<span onDoubleClick={()=>{if(isAdmin)setEditingColorHex(group.hex);}}
                    style={{flex:1,fontSize:"11px",color:"#374151",fontWeight:600,cursor:isAdmin?"text":"default"}}
                    title={isAdmin?"더블클릭하여 이름 변경":""}>
                    {group.name}
                  </span>
                }
                <span style={{fontSize:"10px",color:"#2563eb",fontWeight:700,minWidth:"18px",textAlign:"right"}}>{group.curCount}</span>
                <span style={{fontSize:"9px",color:"#c0c8d6"}}>/</span>
                <span style={{fontSize:"10px",color:"#374151",fontWeight:800,minWidth:"18px"}}>{group.totalCount}</span>
              </div>
            ))
          }
          {isAdmin&&activeColorGroups.length>0&&<p style={{fontSize:"9px",color:"#c0c8d6",marginTop:"2px"}}>이름 더블클릭 변경 · 드래그 순서변경</p>}
        </>}

        {/* ── 버전 히스토리 ── */}
        {sideTab==="versions"&&isAdmin&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <span style={slS}>버전 히스토리</span>
            <button onClick={()=>setModal("saveVersion")} style={{fontSize:"10px",padding:"2px 8px",backgroundColor:"#f0fdf4",color:"#10b981",border:"1px solid #bbf7d0",borderRadius:"4px",cursor:"pointer",fontWeight:700}}>+ 저장</button>
          </div>
          {versions.length===0
            ?<p style={{fontSize:"11px",color:"#c0c8d6",textAlign:"center",paddingTop:"20px"}}>저장된 버전 없음</p>
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

        {/* ── 단축키 ── */}
        {sideTab==="shortcuts"&&isAdmin&&<>
          <span style={slS}>키보드 단축키</span>
          {[["Ctrl+Z","되돌리기"],["Ctrl+D","복제"],["Ctrl+A","전체선택"],["Del","삭제"],["←↑→↓","미세이동 1px"],["Shift+←↑→↓","10px 이동"],["드래그(빈공간)","박스 다중선택"],["Shift+클릭","개별 추가선택"]].map(([k,d])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px"}}>
              <code style={{fontSize:"9px",backgroundColor:"#e2e8f0",padding:"2px 5px",borderRadius:"3px",color:"#475569"}}>{k}</code>
              <span style={{fontSize:"10px",color:"#94a3b8"}}>{d}</span>
            </div>
          ))}
        </>}

        {/* 하단 버튼 */}
        <div style={{marginTop:"auto",paddingTop:"12px",display:"flex",flexDirection:"column",gap:"5px"}}>
          {isAdmin&&<>
            <button onClick={()=>addItem("seat")} style={addBtnS("#eff6ff","#2563eb","#dbeafe")}>🪑 좌석 추가</button>
            <button onClick={()=>addItem("wall")} style={addBtnS("#f8fafc","#475569","#e2e8f0")}>🧱 벽체 추가</button>
            <button onClick={()=>addItem("door")} style={addBtnS("#ecfdf5","#10b981","#d1fae5")}>🚪 문 추가</button>
            <button onClick={()=>setModal("changePw")} style={{padding:"7px",backgroundColor:"#f8fafc",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:"7px",cursor:"pointer",fontSize:"11px",fontWeight:600}}>🔑 비밀번호 변경</button>
          </>}
          <button onClick={()=>isAdmin?setIsAdmin(false):setModal("login")}
            style={{padding:"9px",backgroundColor:isAdmin?"#1e293b":"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
            {isAdmin?"✅ 편집 종료":"🔐 관리자 로그인"}
          </button>
        </div>
      </div>

      {/* ══════ 메인 캔버스 ══════ */}
      <div style={{flex:1,padding:"16px",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {isAdmin&&(
          <div style={{display:"flex",gap:"6px",alignItems:"center",marginBottom:"8px",flexWrap:"wrap"}}>
            <button onClick={()=>{if(undoHistory.length>0){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));}}} style={tbBtnS}>↩ 되돌리기</button>
            <button onClick={selectAll} style={tbBtnS}>☑ 전체선택</button>
            <button onClick={duplicateSelected} disabled={!selectedIds.length} style={{...tbBtnS,opacity:selectedIds.length?1:0.4}}>⿻ 복제</button>
            <button onClick={()=>setModal("saveVersion")} style={{...tbBtnS,backgroundColor:"#f0fdf4",color:"#10b981",border:"1px solid #d1fae5"}}>💾 버전저장</button>
            {overlappingIds.size>0&&<span style={{fontSize:"11px",color:"#ef4444",backgroundColor:"#fef2f2",padding:"4px 10px",borderRadius:"20px",border:"1px solid #fecaca"}}>⚠ {overlappingIds.size}개 겹침</span>}
          </div>
        )}
        <div ref={canvasRef}
          style={{flex:1,borderRadius:"14px",border:"1px solid #e2e8f0",position:"relative",backgroundColor:"#fafafa",backgroundImage:"radial-gradient(#e2e8f0 1px, transparent 1px)",backgroundSize:"20px 20px",overflow:"hidden"}}
          onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}>
          {snapGuides.x!==undefined&&<div style={{position:"absolute",left:snapGuides.x,top:0,bottom:0,width:"1px",backgroundColor:"#2563eb",opacity:0.5,zIndex:200,pointerEvents:"none"}}/>}
          {snapGuides.y!==undefined&&<div style={{position:"absolute",top:snapGuides.y,left:0,right:0,height:"1px",backgroundColor:"#2563eb",opacity:0.5,zIndex:200,pointerEvents:"none"}}/>}
          {boxSel&&<div style={{position:"absolute",left:Math.min(boxSel.sx,boxSel.ex),top:Math.min(boxSel.sy,boxSel.ey),width:Math.abs(boxSel.ex-boxSel.sx),height:Math.abs(boxSel.ey-boxSel.sy),border:"1.5px dashed #2563eb",backgroundColor:"rgba(37,99,235,0.05)",zIndex:300,pointerEvents:"none",borderRadius:"3px"}}/>}
          {curItems.map(item=>{
            const isSel=selectedIds.includes(item.id);
            const isOv=overlappingIds.has(item.id);
            const bgColor=isOv?"#fee2e2":applyOpacity(item.color,colorToOpacity(item.color));
            return (
              <Draggable key={item.id} position={{x:item.x,y:item.y}}
                onStart={()=>{if(!isSel)setSelectedIds([item.id]);}}
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
                <div style={{position:"absolute",zIndex:isSel?100:10}}
                  onClick={e=>{if(!isAdmin)return;e.stopPropagation();
                    if(e.shiftKey)setSelectedIds(p=>p.includes(item.id)?p.filter(id=>id!==item.id):[...p,item.id]);
                    else setSelectedIds([item.id]);}}>
                  {item.type==="door"
                    ?<DoorShape w={item.width} h={item.height} color={item.color} rotation={item.rotation} name={item.name} isSelected={isSel}/>
                    :<div style={{
                        transform:`rotate(${item.rotation}deg)`,
                        width:item.width,height:item.height,
                        backgroundColor:bgColor,
                        border:isSel?"2px solid #2563eb":isOv?"2px solid #ef4444":"1px solid rgba(0,0,0,0.08)",
                        borderRadius:item.type==="wall"?"3px":"7px",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:isOv?"#ef4444":item.textColor,
                        fontSize:"11px",fontWeight:700,textAlign:"center",
                        cursor:isAdmin?"grab":"default",
                        boxShadow:isSel?"0 0 0 3px rgba(37,99,235,0.2)":isOv?"0 0 0 3px rgba(239,68,68,0.2)":"0 1px 3px rgba(0,0,0,0.06)",
                        userSelect:"none",transition:"box-shadow 0.1s",
                      }}>{item.name}</div>
                  }
                </div>
              </Draggable>
            );
          })}
        </div>
      </div>

      {/* ══════ 우측 속성 패널 ══════ */}
      {isAdmin&&(
        <div style={{width:"230px",backgroundColor:"#fff",padding:"14px",borderLeft:"1px solid #e2e8f0",overflowY:"auto",boxShadow:"-2px 0 8px rgba(0,0,0,0.04)"}}>
          {selItems.length===0
            ?<div style={{textAlign:"center",color:"#94a3b8",fontSize:"12px",paddingTop:"40px"}}>
                <div style={{fontSize:"30px",marginBottom:"10px"}}>👆</div>
                좌석을 클릭하거나<br/>드래그로 다중선택
              </div>
            :<>
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

              {/* 배경색 + 투명도 */}
              <div style={pcS}>
                <div style={slS}>🎨 배경색 · 투명도</div>
                {/* 부서 팔레트 */}
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"8px"}}>
                  {departments.map(d=>(
                    <div key={d.id} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(d.color,colorToOpacity(i.color))}:i))}
                      title={d.name}
                      style={{width:"20px",height:"20px",borderRadius:"50%",backgroundColor:d.color,cursor:"pointer",
                        border:colorToHex(selItems[0]?.color)===d.color?"2px solid #1e293b":"2px solid transparent",
                        boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                  ))}
                  {customPalette.map((c,ci)=>(
                    <div key={ci} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(c,colorToOpacity(i.color))}:i))}
                      style={{width:"20px",height:"20px",borderRadius:"50%",backgroundColor:c,cursor:"pointer",border:"2px solid transparent",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                  ))}
                </div>
                {/* 스포이드 */}
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px",padding:"7px",backgroundColor:"#f8fafc",borderRadius:"7px",border:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:"10px",color:"#94a3b8",flexShrink:0}}>🎨</span>
                  <div onClick={()=>pickRef.current?.click()}
                    style={{width:"22px",height:"22px",borderRadius:"50%",backgroundColor:pickColor,border:"2px solid #e2e8f0",cursor:"pointer",flexShrink:0}}/>
                  <input ref={pickRef} type="color" value={pickColor} onChange={e=>setPickColor(e.target.value)} style={{opacity:0,width:0,height:0,position:"absolute"}}/>
                  <button onClick={()=>{
                    updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(pickColor,colorToOpacity(i.color))}:i));
                    if(!customPalette.includes(pickColor)&&customPalette.length<8)setCustomPalette(p=>[...p,pickColor]);
                  }} style={{fontSize:"10px",padding:"4px 8px",backgroundColor:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"5px",cursor:"pointer",fontWeight:700,marginLeft:"auto"}}>
                    적용+저장
                  </button>
                </div>
                {/* 투명도 슬라이더 */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                    <span style={{fontSize:"10px",color:"#94a3b8"}}>투명도</span>
                    <span style={{fontSize:"10px",color:"#64748b",fontWeight:700}}>{Math.round(colorToOpacity(selItems[0]?.color??"")*100)}%</span>
                  </div>
                  <input type="range" min={0.1} max={1} step={0.05}
                    value={colorToOpacity(selItems[0]?.color??"")}
                    onChange={e=>{
                      const op=+e.target.value;
                      updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(colorToHex(i.color),op)}:i));
                    }}
                    style={{width:"100%",accentColor:"#2563eb"}}/>
                </div>
              </div>

              {/* 글자색 - 스포이드만 */}
              <div style={pcS}>
                <div style={slS}>🖋 글자색</div>
                <EyedropperPicker
                  value={selItems[0]?.textColor??"#ffffff"}
                  onChange={v=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,textColor:v}:i))}
                  label="글자색"/>
              </div>

              {/* 회전 */}
              <div style={pcS}>
                <div style={slS}>🔄 회전</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"6px"}}>
                  {([["←90°",-90],["90°→",90],["45°→",45],["180°",180]] as [string,number][]).map(([lbl,deg])=>(
                    <button key={lbl} onClick={()=>rotateObjects(deg)}
                      style={{padding:"7px 4px",border:"1px solid #e2e8f0",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#f0f9ff",fontWeight:600,color:"#374151"}}>
                      {lbl}
                    </button>
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

              {/* 정렬 */}
              <div style={pcS}>
                <div style={slS}>📐 정렬 {selItems.length<2&&<span style={{color:"#fbbf24",fontSize:"9px"}}>(2개↑ 선택)</span>}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",marginBottom:"5px"}}>
                  {([["⬅","left"],["↔","centerV"],["➡","right"],["⬆","top"],["↕","centerH"],["⬇","bottom"]] as [string,Parameters<typeof alignObjects>[0]][]).map(([icon,t])=>(
                    <button key={t} onClick={()=>alignObjects(t)} disabled={selItems.length<2}
                      style={{padding:"7px 4px",border:"1px solid #e2e8f0",borderRadius:"5px",fontSize:"14px",cursor:selItems.length>=2?"pointer":"not-allowed",backgroundColor:selItems.length>=2?"#f8fafc":"#f1f5f9",opacity:selItems.length>=2?1:0.35}}>
                      {icon}
                    </button>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
                  <button onClick={()=>alignObjects("distributeH")} disabled={selItems.length<3}
                    style={{padding:"6px",fontSize:"10px",border:"1px solid #e2e8f0",borderRadius:"5px",cursor:selItems.length>=3?"pointer":"not-allowed",backgroundColor:"#f8fafc",opacity:selItems.length>=3?1:0.35,fontWeight:600}}>↔ 균등</button>
                  <button onClick={()=>alignObjects("distributeV")} disabled={selItems.length<3}
                    style={{padding:"6px",fontSize:"10px",border:"1px solid #e2e8f0",borderRadius:"5px",cursor:selItems.length>=3?"pointer":"not-allowed",backgroundColor:"#f8fafc",opacity:selItems.length>=3?1:0.35,fontWeight:600}}>↕ 균등</button>
                </div>
              </div>

              {/* 편집 */}
              <div style={pcS}>
                <div style={slS}>🛠 편집</div>
                <button onClick={duplicateSelected} style={{width:"100%",padding:"8px",border:"1px solid #d1fae5",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#ecfdf5",color:"#10b981",fontWeight:700,marginBottom:"5px"}}>⿻ 복제 (Ctrl+D)</button>
                <button onClick={()=>{saveHistory();updateItems(curItems.filter(i=>!selectedIds.includes(i.id)));setSelectedIds([]);}}
                  style={{width:"100%",padding:"8px",border:"1px solid #fecaca",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#fef2f2",color:"#ef4444",fontWeight:700}}>🗑 삭제 (Del)</button>
              </div>
            </>
          }
        </div>
      )}
    </main>
  );
}

// ─── 스타일 상수 ─────────────────────────────────────────
const miS: React.CSSProperties={width:"100%",padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
const okBtnS: React.CSSProperties={padding:"10px 24px",backgroundColor:"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:700};
const cxBtnS: React.CSSProperties={padding:"10px 24px",border:"1px solid #e2e8f0",borderRadius:"8px",cursor:"pointer",fontSize:"13px",color:"#64748b",backgroundColor:"#f8fafc"};
const addBtnS=(bg:string,color:string,border:string): React.CSSProperties=>({width:"100%",padding:"8px 12px",backgroundColor:bg,color,border:`1px solid ${border}`,borderRadius:"8px",fontWeight:700,cursor:"pointer",fontSize:"12px",marginBottom:"4px",textAlign:"left"});
const pcS: React.CSSProperties={padding:"11px",border:"1px solid #f1f5f9",borderRadius:"10px",marginBottom:"8px",backgroundColor:"#fafafa"};
const slS: React.CSSProperties={fontSize:"10px",color:"#94a3b8",display:"block",marginBottom:"7px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"};
const inS: React.CSSProperties={width:"100%",padding:"6px 8px",border:"1px solid #e2e8f0",borderRadius:"6px",fontSize:"12px",boxSizing:"border-box",outline:"none",backgroundColor:"#fff"};
const tbBtnS: React.CSSProperties={padding:"6px 12px",backgroundColor:"#fff",border:"1px solid #e2e8f0",borderRadius:"20px",cursor:"pointer",fontSize:"11px",fontWeight:600,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",color:"#475569"};
