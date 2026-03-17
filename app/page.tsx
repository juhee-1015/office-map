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
const SNAP_THRESHOLD = 18;

// 회전 고려한 실제 시각적 너비/높이
function effectiveWH(item: RoomItem): { w: number; h: number } {
  const r = ((item.rotation % 360) + 360) % 360;
  return (r === 90 || r === 270)
    ? { w: item.height, h: item.width }
    : { w: item.width,  h: item.height };
}

// Draggable position(ox,oy) 기준으로 시각적 바운딩박스 반환
// CSS transform:rotate는 div 중심 기준 → 중심점은 항상 (ox + W/2, oy + H/2)
function getBBox(item: RoomItem, ox = item.x, oy = item.y) {
  const { w, h } = effectiveWH(item);
  // 회전 전 div 크기로 중심점 계산 (Draggable position은 회전 전 좌상단)
  const cx = ox + item.width  / 2;
  const cy = oy + item.height / 2;
  // 시각적 바운딩박스 (회전 후 실제 차지하는 영역)
  return { l: cx - w/2, r: cx + w/2, t: cy - h/2, b: cy + h/2, cx, cy };
}

function getSnapPosition(dragging: RoomItem, others: RoomItem[], rawX: number, rawY: number) {
  const d = getBBox(dragging, rawX, rawY);

  let snapCX = d.cx; // 중심점 기준으로 스냅 결과 누적
  let snapCY = d.cy;
  let bestDX = SNAP_THRESHOLD + 1;
  let bestDY = SNAP_THRESHOLD + 1;

  for (const o of others) {
    if (o.id === dragging.id) continue;
    const obb = getBBox(o);

    // X: 내 left/right/center ↔ 상대 left/right/center
    for (const [myEdge, theirEdge] of [
      [d.l,  obb.l ],   // 왼쪽 ↔ 왼쪽 (정렬)
      [d.l,  obb.r ],   // 내 왼쪽 ↔ 상대 오른쪽 (딱 붙기)
      [d.r,  obb.r ],   // 오른쪽 ↔ 오른쪽 (정렬)
      [d.r,  obb.l ],   // 내 오른쪽 ↔ 상대 왼쪽 (딱 붙기)
      [d.cx, obb.cx],   // 중앙 ↔ 중앙
    ] as [number,number][]) {
      const dist = Math.abs(myEdge - theirEdge);
      if (dist < bestDX) {
        bestDX = dist;
        // 스냅 후 중심점 x = 현재 중심점 + 보정값
        snapCX = d.cx + (theirEdge - myEdge);
      }
    }

    // Y: 내 top/bottom/center ↔ 상대 top/bottom/center
    for (const [myEdge, theirEdge] of [
      [d.t,  obb.t ],
      [d.t,  obb.b ],
      [d.b,  obb.b ],
      [d.b,  obb.t ],
      [d.cy, obb.cy],
    ] as [number,number][]) {
      const dist = Math.abs(myEdge - theirEdge);
      if (dist < bestDY) {
        bestDY = dist;
        snapCY = d.cy + (theirEdge - myEdge);
      }
    }
  }

  // 중심점 → Draggable position(좌상단)으로 역변환
  const finalX = snapCX - dragging.width  / 2;
  const finalY = snapCY - dragging.height / 2;

  return {
    x: bestDX <= SNAP_THRESHOLD ? finalX : rawX,
    y: bestDY <= SNAP_THRESHOLD ? finalY : rawY,
    snappedX: bestDX <= SNAP_THRESHOLD,
    snappedY: bestDY <= SNAP_THRESHOLD,
  };
}

function isOverlapping(a: RoomItem, b: RoomItem): boolean {
  if (a.id === b.id) return false;
  const ba = getBBox(a), bb = getBBox(b);
  return ba.l + 1 < bb.r && ba.r - 1 > bb.l && ba.t + 1 < bb.b && ba.b - 1 > bb.t;
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
// ── 초기 배치도 데이터 (엑셀 자동 변환) ──────────────────
const INITIAL_DATA = {"floors":[{"id":"F5","displayName":"5층 (아트실)","items":[{"id":1,"type":"seat","name":"조성빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":523,"y":20},{"id":2,"type":"seat","name":"김선민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":612,"y":20},{"id":3,"type":"seat","name":"전병성","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":671,"y":20},{"id":4,"type":"seat","name":"이지은","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":760,"y":20},{"id":5,"type":"seat","name":"김학민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":819,"y":20},{"id":6,"type":"seat","name":"김지은","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":20},{"id":7,"type":"seat","name":"윤준영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1056,"y":20},{"id":8,"type":"seat","name":"남예지","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1115,"y":20},{"id":9,"type":"seat","name":"황선경","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1204,"y":20},{"id":10,"type":"seat","name":"정승연","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1323,"y":20},{"id":11,"type":"seat","name":"류한경","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1382,"y":20},{"id":12,"type":"seat","name":"이나래","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":64},{"id":13,"type":"seat","name":"이혜정","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":168,"y":64},{"id":14,"type":"seat","name":"김가영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":316,"y":64},{"id":15,"type":"seat","name":"서연주","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":375,"y":64},{"id":16,"type":"seat","name":"김동리","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":523,"y":64},{"id":17,"type":"seat","name":"오승재","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":612,"y":64},{"id":18,"type":"seat","name":"김세은","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":671,"y":64},{"id":19,"type":"seat","name":"손지혜","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":760,"y":64},{"id":20,"type":"seat","name":"김건우","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":819,"y":64},{"id":21,"type":"seat","name":"이민재","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":64},{"id":22,"type":"seat","name":"손주호","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1056,"y":64},{"id":23,"type":"seat","name":"서어진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1115,"y":64},{"id":24,"type":"seat","name":"임윤하","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1323,"y":64},{"id":25,"type":"seat","name":"이상현","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1382,"y":64},{"id":26,"type":"seat","name":"박서휘","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1441,"y":64},{"id":27,"type":"seat","name":"박상흠","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":108},{"id":28,"type":"seat","name":"김려원","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":108},{"id":29,"type":"seat","name":"문수진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":168,"y":108},{"id":30,"type":"seat","name":"김주영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":316,"y":108},{"id":31,"type":"seat","name":"박현이","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":375,"y":108},{"id":32,"type":"seat","name":"강은표","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":464,"y":108},{"id":33,"type":"seat","name":"이수빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":612,"y":108},{"id":34,"type":"seat","name":"강경준","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":671,"y":108},{"id":35,"type":"seat","name":"백형록","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":760,"y":108},{"id":36,"type":"seat","name":"정수민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":108},{"id":37,"type":"seat","name":"박경수","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":108},{"id":38,"type":"seat","name":"문해온","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1056,"y":108},{"id":39,"type":"seat","name":"김지민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1115,"y":108},{"id":40,"type":"seat","name":"윤송이","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1382,"y":108},{"id":41,"type":"seat","name":"이은빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1441,"y":108},{"id":42,"type":"seat","name":"이정주","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":212},{"id":43,"type":"seat","name":"성혜진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":212},{"id":44,"type":"seat","name":"김기윤","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":168,"y":212},{"id":45,"type":"seat","name":"김민경","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":227,"y":212},{"id":46,"type":"seat","name":"김재형","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":316,"y":212},{"id":47,"type":"seat","name":"정태양","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":375,"y":212},{"id":48,"type":"seat","name":"이은비","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":256},{"id":49,"type":"seat","name":"김은진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":227,"y":256},{"id":50,"type":"seat","name":"김종학","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":316,"y":256},{"id":51,"type":"seat","name":"허유빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":375,"y":256},{"id":52,"type":"seat","name":"이윤수","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":464,"y":256},{"id":53,"type":"seat","name":"신건우","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":300},{"id":54,"type":"seat","name":"조성해","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":227,"y":300},{"id":55,"type":"seat","name":"권소영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":316,"y":300},{"id":56,"type":"seat","name":"김보연","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":375,"y":300},{"id":57,"type":"seat","name":"권두환","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":464,"y":300}],"zones":[]},{"id":"F6","displayName":"6층 (개발/경영)","items":[{"id":58,"type":"seat","name":"최오성","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":449,"y":20},{"id":59,"type":"seat","name":"최성욱","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":20},{"id":60,"type":"seat","name":"최선우","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":20},{"id":61,"type":"seat","name":"유별라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":962,"y":20},{"id":62,"type":"seat","name":"임보라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1021,"y":20},{"id":63,"type":"seat","name":"김화영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1125,"y":20},{"id":64,"type":"seat","name":"김신혜","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1184,"y":20},{"id":65,"type":"seat","name":"안승호","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":64},{"id":66,"type":"seat","name":"김혁진","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":247,"y":64},{"id":67,"type":"seat","name":"장지웅","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":449,"y":64},{"id":68,"type":"seat","name":"박환용","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":64},{"id":69,"type":"seat","name":"김민찬","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":64},{"id":70,"type":"seat","name":"최성민","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":676,"y":64},{"id":71,"type":"seat","name":"김성","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":735,"y":64},{"id":72,"type":"seat","name":"문다슬","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":878,"y":64},{"id":73,"type":"seat","name":"박진용","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":962,"y":64},{"id":74,"type":"seat","name":"정지현","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1021,"y":64},{"id":75,"type":"seat","name":"서지인","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1125,"y":64},{"id":76,"type":"seat","name":"김서을","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1243,"y":64},{"id":77,"type":"seat","name":"최호준","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":108},{"id":78,"type":"seat","name":"이세영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":108},{"id":79,"type":"seat","name":"박진곤","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":247,"y":108},{"id":80,"type":"seat","name":"조태현","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":306,"y":108},{"id":81,"type":"seat","name":"김정은","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":390,"y":108},{"id":82,"type":"seat","name":"조용호","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":449,"y":108},{"id":83,"type":"seat","name":"김동훈","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":108},{"id":84,"type":"seat","name":"김승환","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":108},{"id":85,"type":"seat","name":"김원학","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":676,"y":108},{"id":86,"type":"seat","name":"백승열","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":735,"y":108},{"id":87,"type":"seat","name":"주건영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":819,"y":108},{"id":88,"type":"seat","name":"신서아","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":878,"y":108},{"id":89,"type":"seat","name":"고민서","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":962,"y":108},{"id":90,"type":"seat","name":"김유라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1021,"y":108},{"id":91,"type":"seat","name":"이재원","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1125,"y":108},{"id":92,"type":"seat","name":"공유라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1184,"y":108},{"id":93,"type":"seat","name":"허인지","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1243,"y":108},{"id":94,"type":"seat","name":"박성진","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":192},{"id":95,"type":"seat","name":"문정인","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":104,"y":192},{"id":96,"type":"seat","name":"최기원","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":306,"y":192},{"id":97,"type":"seat","name":"이동석","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":390,"y":192},{"id":98,"type":"seat","name":"정구연","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":104,"y":236},{"id":99,"type":"seat","name":"채준","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":236},{"id":100,"type":"seat","name":"김대현","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":247,"y":236},{"id":101,"type":"seat","name":"강주영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":306,"y":236},{"id":102,"type":"seat","name":"이민선","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":390,"y":236},{"id":103,"type":"seat","name":"배현준","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":104,"y":280},{"id":104,"type":"seat","name":"하동익","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":280},{"id":105,"type":"seat","name":"안기수","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":247,"y":280},{"id":106,"type":"seat","name":"조화평","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":306,"y":280},{"id":107,"type":"seat","name":"서형택","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":360},{"id":108,"type":"seat","name":"임혜리","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":360},{"id":109,"type":"seat","name":"함은비","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":360},{"id":110,"type":"seat","name":"조성훈","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":424,"y":360},{"id":111,"type":"seat","name":"김민재","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":523,"y":360},{"id":112,"type":"seat","name":"강우영","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":607,"y":360},{"id":113,"type":"seat","name":"강동우","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":893,"y":360},{"id":114,"type":"seat","name":"이상연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":952,"y":360},{"id":115,"type":"seat","name":"이준호","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1179,"y":360},{"id":116,"type":"seat","name":"손은경","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1322,"y":360},{"id":117,"type":"seat","name":"CEO","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1381,"y":360},{"id":118,"type":"seat","name":"최종성","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":404},{"id":119,"type":"seat","name":"박예령","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":404},{"id":120,"type":"seat","name":"박용현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":404},{"id":121,"type":"seat","name":"최정효","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":424,"y":404},{"id":122,"type":"seat","name":"박건호","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":607,"y":404},{"id":123,"type":"seat","name":"이상희","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":893,"y":404},{"id":124,"type":"seat","name":"송윤선","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":952,"y":404},{"id":125,"type":"seat","name":"허대균","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1179,"y":404},{"id":126,"type":"seat","name":"박근홍","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1322,"y":404},{"id":127,"type":"seat","name":"나경엽","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":478},{"id":128,"type":"seat","name":"박지윤","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":281,"y":478},{"id":129,"type":"seat","name":"장지아","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":365,"y":478},{"id":130,"type":"seat","name":"노희상","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":523,"y":478},{"id":131,"type":"seat","name":"김영욱","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":607,"y":478},{"id":132,"type":"seat","name":"이아연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":750,"y":478},{"id":133,"type":"seat","name":"김한모","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":809,"y":478},{"id":134,"type":"seat","name":"최수린","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":893,"y":478},{"id":135,"type":"seat","name":"이명준","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":952,"y":478},{"id":136,"type":"seat","name":"마예슬","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1036,"y":478},{"id":137,"type":"seat","name":"이근","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1179,"y":478},{"id":138,"type":"seat","name":"안희준","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1322,"y":478},{"id":139,"type":"seat","name":"노현수","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1381,"y":478},{"id":140,"type":"seat","name":"이기녕","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1465,"y":478},{"id":141,"type":"seat","name":"유소정","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":281,"y":522},{"id":142,"type":"seat","name":"이민재B","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":365,"y":522},{"id":143,"type":"seat","name":"이예니","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":424,"y":522},{"id":144,"type":"seat","name":"박국현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":607,"y":522},{"id":145,"type":"seat","name":"유상용","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":666,"y":522},{"id":146,"type":"seat","name":"박현준","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":750,"y":522},{"id":147,"type":"seat","name":"류혜령","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":809,"y":522},{"id":148,"type":"seat","name":"이병연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":893,"y":522},{"id":149,"type":"seat","name":"최소원","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":952,"y":522},{"id":150,"type":"seat","name":"박지연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1036,"y":522},{"id":151,"type":"seat","name":"노근석","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1179,"y":522},{"id":152,"type":"seat","name":"허정윤","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1322,"y":522},{"id":153,"type":"seat","name":"설유진","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1381,"y":522},{"id":154,"type":"seat","name":"최영현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1465,"y":522},{"id":155,"type":"seat","name":"조혜진","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":566},{"id":156,"type":"seat","name":"신동근","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":424,"y":566},{"id":157,"type":"seat","name":"반창현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":607,"y":566},{"id":158,"type":"seat","name":"탁광진","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":750,"y":566},{"id":159,"type":"seat","name":"이동윤","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":893,"y":566},{"id":160,"type":"seat","name":"박영수","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1036,"y":566},{"id":161,"type":"seat","name":"이가은","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1179,"y":566},{"id":162,"type":"seat","name":"강문현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1322,"y":566},{"id":163,"type":"seat","name":"고지혜","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1381,"y":566}],"zones":[]},{"id":"F7","displayName":"7층 (SSR)","items":[{"id":164,"type":"seat","name":"강명진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":20},{"id":165,"type":"seat","name":"한유종","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":20},{"id":166,"type":"seat","name":"권나현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":449,"y":20},{"id":167,"type":"seat","name":"남현민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":20},{"id":168,"type":"seat","name":"김현호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":676,"y":20},{"id":169,"type":"seat","name":"김지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":20},{"id":170,"type":"seat","name":"김탁곤","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":20},{"id":171,"type":"seat","name":"박동연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":20},{"id":172,"type":"seat","name":"문소영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":20},{"id":173,"type":"seat","name":"소수빈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":20},{"id":174,"type":"seat","name":"류경서","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":20},{"id":175,"type":"seat","name":"성시우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":20},{"id":176,"type":"seat","name":"민성호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":20},{"id":177,"type":"seat","name":"황현정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":64},{"id":178,"type":"seat","name":"박예슬","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":64},{"id":179,"type":"seat","name":"나병한","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":64},{"id":180,"type":"seat","name":"김준범","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":64},{"id":181,"type":"seat","name":"김비오","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":390,"y":64},{"id":182,"type":"seat","name":"홍진성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":449,"y":64},{"id":183,"type":"seat","name":"김덕유","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":64},{"id":184,"type":"seat","name":"김예준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":64},{"id":185,"type":"seat","name":"정원재","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":676,"y":64},{"id":186,"type":"seat","name":"최시우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":64},{"id":187,"type":"seat","name":"방아정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":64},{"id":188,"type":"seat","name":"강지은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":64},{"id":189,"type":"seat","name":"김창현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":64},{"id":190,"type":"seat","name":"박지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":64},{"id":191,"type":"seat","name":"형성찬","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":64},{"id":192,"type":"seat","name":"김시나","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":64},{"id":193,"type":"seat","name":"김해리","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":64},{"id":194,"type":"seat","name":"엄지손","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":64},{"id":195,"type":"seat","name":"이용준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":108},{"id":196,"type":"seat","name":"이승훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":108},{"id":197,"type":"seat","name":"장이국","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":163,"y":108},{"id":198,"type":"seat","name":"위지영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":108},{"id":199,"type":"seat","name":"허준희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":449,"y":108},{"id":200,"type":"seat","name":"김지수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":108},{"id":201,"type":"seat","name":"조민혁","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":108},{"id":202,"type":"seat","name":"서동주","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":676,"y":108},{"id":203,"type":"seat","name":"김주연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":108},{"id":204,"type":"seat","name":"이현희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":108},{"id":205,"type":"seat","name":"고효정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":108},{"id":206,"type":"seat","name":"이주형","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":108},{"id":207,"type":"seat","name":"김주진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":108},{"id":208,"type":"seat","name":"차석운","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":108},{"id":209,"type":"seat","name":"최원석","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":108},{"id":210,"type":"seat","name":"김민제","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":108},{"id":211,"type":"seat","name":"이민우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":108},{"id":212,"type":"seat","name":"김호진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":108},{"id":213,"type":"seat","name":"이재훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":108},{"id":214,"type":"seat","name":"부혜진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":172},{"id":215,"type":"seat","name":"김지원B","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":172},{"id":216,"type":"seat","name":"서현성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":172},{"id":217,"type":"seat","name":"염승화","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":172},{"id":218,"type":"seat","name":"전홍집","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":172},{"id":219,"type":"seat","name":"오정훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":172},{"id":220,"type":"seat","name":"박준식","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":172},{"id":221,"type":"seat","name":"나동원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":172},{"id":222,"type":"seat","name":"정진영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":172},{"id":223,"type":"seat","name":"김은성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":172},{"id":224,"type":"seat","name":"박다유","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":172},{"id":225,"type":"seat","name":"장은준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":182},{"id":226,"type":"seat","name":"최현지","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":182},{"id":227,"type":"seat","name":"이현정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":182},{"id":228,"type":"seat","name":"이동우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":306,"y":182},{"id":229,"type":"seat","name":"김소라","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":182},{"id":230,"type":"seat","name":"신성우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":182},{"id":231,"type":"seat","name":"박성진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":676,"y":182},{"id":232,"type":"seat","name":"서주희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":770,"y":182},{"id":233,"type":"seat","name":"김하연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":216},{"id":234,"type":"seat","name":"탁다운","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":216},{"id":235,"type":"seat","name":"이은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":216},{"id":236,"type":"seat","name":"김동재","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":216},{"id":237,"type":"seat","name":"이민정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":216},{"id":238,"type":"seat","name":"한지현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":216},{"id":239,"type":"seat","name":"박나래","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":216},{"id":240,"type":"seat","name":"이민지","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":216},{"id":241,"type":"seat","name":"최호준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":20,"y":226},{"id":242,"type":"seat","name":"이준수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":79,"y":226},{"id":243,"type":"seat","name":"김현진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":222,"y":226},{"id":244,"type":"seat","name":"조하영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":306,"y":226},{"id":245,"type":"seat","name":"유영호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":226},{"id":246,"type":"seat","name":"류근우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":592,"y":226},{"id":247,"type":"seat","name":"남궁호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":770,"y":226},{"id":248,"type":"seat","name":"김지민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":829,"y":226},{"id":249,"type":"seat","name":"고병호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":533,"y":270},{"id":250,"type":"seat","name":"김수연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":257,"y":300},{"id":251,"type":"seat","name":"배지환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":479,"y":300},{"id":252,"type":"seat","name":"홍성우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":765,"y":300},{"id":253,"type":"seat","name":"한미현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":824,"y":300},{"id":254,"type":"seat","name":"최지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1051,"y":300},{"id":255,"type":"seat","name":"하헌영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1110,"y":300},{"id":256,"type":"seat","name":"신재희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1337,"y":300},{"id":257,"type":"seat","name":"임한규","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":257,"y":344},{"id":258,"type":"seat","name":"엄홍주","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":479,"y":344},{"id":259,"type":"seat","name":"이지수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":538,"y":344},{"id":260,"type":"seat","name":"황명윤","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":765,"y":344},{"id":261,"type":"seat","name":"임효선","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":824,"y":344},{"id":262,"type":"seat","name":"오승완","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1051,"y":344},{"id":263,"type":"seat","name":"김수진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1110,"y":344},{"id":264,"type":"seat","name":"김건욱","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1337,"y":344},{"id":265,"type":"seat","name":"최웅환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":257,"y":388},{"id":266,"type":"seat","name":"배제성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":479,"y":388},{"id":267,"type":"seat","name":"이수경","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":538,"y":388},{"id":268,"type":"seat","name":"탁예은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":765,"y":388},{"id":269,"type":"seat","name":"박고은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":824,"y":388},{"id":270,"type":"seat","name":"하정현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1051,"y":388},{"id":271,"type":"seat","name":"이현아","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1110,"y":388},{"id":272,"type":"seat","name":"유별라","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1337,"y":388},{"id":273,"type":"seat","name":"이용철","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":257,"y":432},{"id":274,"type":"seat","name":"이찬영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":479,"y":432},{"id":275,"type":"seat","name":"이나레","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":538,"y":432},{"id":276,"type":"seat","name":"민소영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":765,"y":432},{"id":277,"type":"seat","name":"조윤진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":824,"y":432},{"id":278,"type":"seat","name":"장시은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1051,"y":432},{"id":279,"type":"seat","name":"박종철","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1110,"y":432},{"id":280,"type":"seat","name":"박상우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1337,"y":432},{"id":281,"type":"seat","name":"이성수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":496},{"id":282,"type":"seat","name":"김민섭","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":496},{"id":283,"type":"seat","name":"안성범","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":496},{"id":284,"type":"seat","name":"이승원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":496},{"id":285,"type":"seat","name":"조홍래","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":496},{"id":286,"type":"seat","name":"김동민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":496},{"id":287,"type":"seat","name":"이창현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":496},{"id":288,"type":"seat","name":"홍다운","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":496},{"id":289,"type":"seat","name":"장한솔","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":496},{"id":290,"type":"seat","name":"이은서","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":496},{"id":291,"type":"seat","name":"김문형","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":496},{"id":292,"type":"seat","name":"조간섭","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":540},{"id":293,"type":"seat","name":"김민경","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":540},{"id":294,"type":"seat","name":"성주녕","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":540},{"id":295,"type":"seat","name":"정유경","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":540},{"id":296,"type":"seat","name":"이지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":540},{"id":297,"type":"seat","name":"손현목","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":540},{"id":298,"type":"seat","name":"남예림","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":540},{"id":299,"type":"seat","name":"곽은정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":540},{"id":300,"type":"seat","name":"이현동","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":540},{"id":301,"type":"seat","name":"유정훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":540},{"id":302,"type":"seat","name":"김찬우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":540},{"id":303,"type":"seat","name":"이재현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":584},{"id":304,"type":"seat","name":"최원천","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":584},{"id":305,"type":"seat","name":"위수현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":584},{"id":306,"type":"seat","name":"원종영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":584},{"id":307,"type":"seat","name":"김기범","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":584},{"id":308,"type":"seat","name":"구자영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":584},{"id":309,"type":"seat","name":"정미아","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":584},{"id":310,"type":"seat","name":"김다은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":584},{"id":311,"type":"seat","name":"정윤희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":584},{"id":312,"type":"seat","name":"최승현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":584},{"id":313,"type":"seat","name":"이정환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":584},{"id":314,"type":"seat","name":"박혜민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":628},{"id":315,"type":"seat","name":"표세준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":114,"y":628},{"id":316,"type":"seat","name":"전영철","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":173,"y":628},{"id":317,"type":"seat","name":"이진원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":628},{"id":318,"type":"seat","name":"김민석","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":628},{"id":319,"type":"seat","name":"하병찬","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":628},{"id":320,"type":"seat","name":"지연님","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":681,"y":628},{"id":321,"type":"seat","name":"강다은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":908,"y":628},{"id":322,"type":"seat","name":"유상용","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":967,"y":628},{"id":323,"type":"seat","name":"차재현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1194,"y":628},{"id":324,"type":"seat","name":"이유미","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":1253,"y":628},{"id":325,"type":"seat","name":"박새별","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":40,"y":672},{"id":326,"type":"seat","name":"허원영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":336,"y":672},{"id":327,"type":"seat","name":"공지환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":395,"y":672},{"id":328,"type":"seat","name":"김세연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":55,"height":40,"x":622,"y":672}],"zones":[]}],"activeFloorId":"F5","appTitle":"슈퍼크리에이티브 배치도","colorGroupNames":{},"colorGroupOrder":[],"customPalette":[]} as const;

export default function SeatMapSystem() {
  const [hasMounted, setHasMounted] = useState(false);
  const [appTitle, setAppTitle] = useState<string>(INITIAL_DATA.appTitle as string);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("1234");

  const [floors, setFloors] = useState<FloorInfo[]>(INITIAL_DATA.floors as unknown as FloorInfo[]);
  const [activeFloorId, setActiveFloorId] = useState<string>(INITIAL_DATA.activeFloorId as string);
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
  const [allowOverlap, setAllowOverlap] = useState(false); // 겹침 허용 토글

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

  // 브라우저 탭 제목 동기화
  useEffect(()=>{ document.title = appTitle; },[appTitle]);

  // ── 저장/불러오기 (Vercel Blob API) ────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");

  // 앱 시작 시 서버에서 불러오기
  useEffect(()=>{
    fetch("/api/load")
      .then(r=>{ if(!r.ok) throw new Error(); return r.json(); })
      .then(data=>{
        if(!data) return;
        if(data.floors) setFloors(data.floors);
        if(data.activeFloorId) setActiveFloorId(data.activeFloorId);
        if(data.appTitle) setAppTitle(data.appTitle);
        if(data.colorGroupNames) setColorGroupNames(data.colorGroupNames);
        if(data.colorGroupOrder) setColorGroupOrder(data.colorGroupOrder);
        if(data.customPalette) setCustomPalette(data.customPalette);
      })
      .catch(e=>console.error("불러오기 실패",e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // 저장 핸들러
  const handleSaveToServer = useCallback(async()=>{
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/save",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ floors, activeFloorId, appTitle, colorGroupNames, colorGroupOrder, customPalette }),
      });
      if(!res.ok) throw new Error();
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"), 2000);
    } catch(e){
      console.error("저장 실패",e);
      setSaveStatus("error");
      setTimeout(()=>setSaveStatus("idle"), 2000);
    }
  },[floors, activeFloorId, appTitle, colorGroupNames, colorGroupOrder, customPalette]);

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
    if(allowOverlap){ setOverlappingIds(new Set()); return; }
    const ov=new Set<number>();
    for(let i=0;i<newItems.length;i++)for(let j=i+1;j<newItems.length;j++)
      if(isOverlapping(newItems[i],newItems[j])&&newItems[i].type==="seat"&&newItems[j].type==="seat"){ov.add(newItems[i].id);ov.add(newItems[j].id);}
    setOverlappingIds(ov);
  },[activeFloorId, allowOverlap]);

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
          {/* ☁️ 저장 버튼 — 관리자/비관리자 모두 표시 */}
          <button onClick={handleSaveToServer}
            disabled={saveStatus==="saving"}
            style={{...tbBtnS,
              backgroundColor: saveStatus==="saved"?"#f0fdf4":saveStatus==="error"?"#fef2f2":"#ecfdf5",
              color: saveStatus==="saved"?"#059669":saveStatus==="error"?"#ef4444":"#059669",
              border: saveStatus==="error"?"1px solid #fecaca":"1px solid #d1fae5",
              fontWeight:700,
              opacity: saveStatus==="saving"?0.6:1,
            }}>
            {saveStatus==="saving"?"저장 중...":saveStatus==="saved"?"✅ 저장됨":saveStatus==="error"?"❌ 오류":"☁️ 저장"}
          </button>
          {isAdmin&&<>
            <button onClick={()=>{if(undoHistory.length>0){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));} }} style={tbBtnS}>↩ 되돌리기</button>
            <button onClick={selectAll} style={tbBtnS}>☑ 전체선택</button>
            <button onClick={duplicateSelected} disabled={!selectedIds.length} style={{...tbBtnS,opacity:selectedIds.length?1:0.4}}>⿻ 복제</button>
            <button onClick={()=>setModal("saveVersion")} style={{...tbBtnS,backgroundColor:"#f8fafc",color:"#64748b",border:"1px solid #e2e8f0"}}>🗂 버전</button>
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
            {overlappingIds.size>0&&!allowOverlap&&<span style={{fontSize:"11px",color:"#ef4444",backgroundColor:"#fef2f2",padding:"4px 10px",borderRadius:"20px",border:"1px solid #fecaca"}}>⚠ {overlappingIds.size}개 겹침</span>}
            <button onClick={()=>setAllowOverlap(p=>!p)}
              style={{...tbBtnS,
                backgroundColor:allowOverlap?"#fef9c3":"#fff",
                color:allowOverlap?"#b45309":"#94a3b8",
                border:allowOverlap?"1px solid #fde68a":"1px solid #e2e8f0",
                fontSize:"10px",
              }}>
              {allowOverlap?"⚠ 겹침허용 ON":"겹침허용"}
            </button>
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
