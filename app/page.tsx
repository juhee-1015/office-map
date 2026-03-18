"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Draggable from "react-draggable";

type ItemType = "seat"|"wall"|"door"|"space";
interface RoomItem { id:number; type:ItemType; name:string; rotation:number; color:string; textColor:string; opacity:number; textOpacity:number; width:number; height:number; x:number; y:number; }
interface Zone { id:number; name:string; color:string; x:number; y:number; width:number; height:number; }
interface FloorInfo { id:string; displayName:string; items:RoomItem[]; zones:Zone[]; }
interface Department { id:string; name:string; color:string; }
interface VersionSnapshot { id:string; label:string; savedAt:string; floors:FloorInfo[]; }

function hexToRgba(hex:string,opacity:number):string{const c=hex.replace("#","");return `rgba(${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)},${opacity})`;}
function rgbaToHexOpacity(rgba:string):{hex:string;opacity:number}{const m=rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(!m)return{hex:rgba.startsWith("#")?rgba:"#3b82f6",opacity:1};const h=(n:number)=>n.toString(16).padStart(2,"0");return{hex:`#${h(+m[1])}${h(+m[2])}${h(+m[3])}`,opacity:m[4]!==undefined?+m[4]:1};}
function colorToHex(c:string):string{if(c.startsWith("#"))return c;if(c.startsWith("rgb"))return rgbaToHexOpacity(c).hex;return c;}
function colorToOpacity(c:string):number{return c.startsWith("rgba")?rgbaToHexOpacity(c).opacity:1;}
function applyOpacity(color:string,opacity:number):string{return hexToRgba(colorToHex(color),opacity);}

const SNAP_THRESHOLD=6;
function effectiveWH(item:RoomItem):{w:number;h:number}{const r=((item.rotation%360)+360)%360;return(r===90||r===270)?{w:item.height,h:item.width}:{w:item.width,h:item.height};}
function getBBox(item:RoomItem,ox:number,oy:number):{l:number;r:number;t:number;b:number}{const{w,h}=effectiveWH(item);const cx=ox+item.width/2,cy=oy+item.height/2;return{l:cx-w/2,r:cx+w/2,t:cy-h/2,b:cy+h/2};}
function getSnapPosition(item:RoomItem,others:RoomItem[],ox:number,oy:number):{x:number;y:number;snappedX:boolean;snappedY:boolean}{
  let sx=ox,sy=oy,snappedX=false,snappedY=false;
  const b=getBBox(item,ox,oy);
  let bestDx=SNAP_THRESHOLD,bestDy=SNAP_THRESHOLD;
  for(const o of others){
    const ob2=getBBox(o,o.x,o.y);
    const xc=[{d:Math.abs(b.l-ob2.l),v:ob2.l-(b.l-ox)},{d:Math.abs(b.l-ob2.r),v:ob2.r-(b.l-ox)},{d:Math.abs(b.r-ob2.l),v:ob2.l-(b.r-ox)},{d:Math.abs(b.r-ob2.r),v:ob2.r-(b.r-ox)}];
    for(const c of xc){if(c.d<bestDx){bestDx=c.d;sx=c.v;snappedX=true;}}
    const yc=[{d:Math.abs(b.t-ob2.t),v:ob2.t-(b.t-oy)},{d:Math.abs(b.t-ob2.b),v:ob2.b-(b.t-oy)},{d:Math.abs(b.b-ob2.t),v:ob2.t-(b.b-oy)},{d:Math.abs(b.b-ob2.b),v:ob2.b-(b.b-oy)}];
    for(const c of yc){if(c.d<bestDy){bestDy=c.d;sy=c.v;snappedY=true;}}
  }
  return{x:sx,y:sy,snappedX,snappedY};
}
function isOverlapping(a:RoomItem,b:RoomItem):boolean{const ba=getBBox(a,a.x,a.y),bb=getBBox(b,b.x,b.y);return ba.l<bb.r-1&&ba.r>bb.l+1&&ba.t<bb.b-1&&ba.b>bb.t+1;}
function emptyFloor(id:string,name:string):FloorInfo{return{id,displayName:name,items:[],zones:[]};}

function exportToPNG(el:HTMLElement,title:string,floorName:string){const w=window.open("","_blank");if(!w)return;w.document.write(`<html><head><title>${title}_${floorName}</title><style>body{margin:0;padding:16px;background:#fafafa;}*{font-family:'Apple SD Gothic Neo',sans-serif;box-sizing:border-box;}</style></head><body>${el.outerHTML}</body></html>`);w.document.close();setTimeout(()=>{w.print();},600);}

function DoorShape({w,h,color,rotation,name,isSelected}:{w:number;h:number;color:string;rotation:number;name:string;isSelected:boolean}){const r=rotation%360;const sweep=r===90||r===270?`${w} 0 A${w} ${w} 0 0 1 0 ${w}`:`${h} 0 A${h} ${h} 0 0 1 0 ${h}`;const vw=r===90||r===270?Math.max(w,h):w+4;const vh=r===90||r===270?Math.max(w,h):h+4;return(<svg width={vw} height={vh} style={{transform:`rotate(${rotation}deg)`,display:"block"}}><rect width={w} height={h} fill={isSelected?"#dbeafe":color} stroke={isSelected?"#2563eb":color} strokeWidth={isSelected?2:1} rx={2}/><path d={`M 0 0 L ${sweep}`} fill="none" stroke={isSelected?"#2563eb":color} strokeWidth={1} strokeDasharray="3,2" opacity={0.6}/>{name&&<text x={w/2} y={h/2+4} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={700}>{name}</text>}</svg>);}

// ── 초기 배치도 데이터 (엑셀 자동 변환) ──────────────────
const INITIAL_DATA = {"floors":[{"id":"F5","displayName":"5층 (아트실)","items":[{"id":1,"type":"seat","name":"조성빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":523,"y":20},{"id":2,"type":"seat","name":"김선민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":612,"y":20},{"id":3,"type":"seat","name":"전병성","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":671,"y":20},{"id":4,"type":"seat","name":"이지은","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":760,"y":20},{"id":5,"type":"seat","name":"김학민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":819,"y":20},{"id":6,"type":"seat","name":"김지은","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":20},{"id":7,"type":"seat","name":"윤준영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1056,"y":20},{"id":8,"type":"seat","name":"남예지","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1115,"y":20},{"id":9,"type":"seat","name":"황선경","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1204,"y":20},{"id":10,"type":"seat","name":"정승연","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1323,"y":20},{"id":11,"type":"seat","name":"류한경","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1382,"y":20},{"id":12,"type":"seat","name":"이나래","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":64},{"id":13,"type":"seat","name":"이혜정","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":168,"y":64},{"id":14,"type":"seat","name":"김가영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":316,"y":64},{"id":15,"type":"seat","name":"서연주","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":375,"y":64},{"id":16,"type":"seat","name":"김동리","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":523,"y":64},{"id":17,"type":"seat","name":"오승재","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":612,"y":64},{"id":18,"type":"seat","name":"김세은","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":671,"y":64},{"id":19,"type":"seat","name":"손지혜","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":760,"y":64},{"id":20,"type":"seat","name":"김건우","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":819,"y":64},{"id":21,"type":"seat","name":"이민재","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":64},{"id":22,"type":"seat","name":"손주호","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1056,"y":64},{"id":23,"type":"seat","name":"서어진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1115,"y":64},{"id":24,"type":"seat","name":"임윤하","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1323,"y":64},{"id":25,"type":"seat","name":"이상현","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1382,"y":64},{"id":26,"type":"seat","name":"박서휘","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1441,"y":64},{"id":27,"type":"seat","name":"박상흠","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":108},{"id":28,"type":"seat","name":"김려원","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":108},{"id":29,"type":"seat","name":"문수진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":168,"y":108},{"id":30,"type":"seat","name":"김주영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":316,"y":108},{"id":31,"type":"seat","name":"박현이","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":375,"y":108},{"id":32,"type":"seat","name":"강은표","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":464,"y":108},{"id":33,"type":"seat","name":"이수빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":612,"y":108},{"id":34,"type":"seat","name":"강경준","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":671,"y":108},{"id":35,"type":"seat","name":"백형록","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":760,"y":108},{"id":36,"type":"seat","name":"정수민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":108},{"id":37,"type":"seat","name":"박경수","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":108},{"id":38,"type":"seat","name":"문해온","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1056,"y":108},{"id":39,"type":"seat","name":"김지민","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1115,"y":108},{"id":40,"type":"seat","name":"윤송이","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1382,"y":108},{"id":41,"type":"seat","name":"이은빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1441,"y":108},{"id":42,"type":"seat","name":"이정주","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":212},{"id":43,"type":"seat","name":"성혜진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":212},{"id":44,"type":"seat","name":"김기윤","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":168,"y":212},{"id":45,"type":"seat","name":"김민경","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":227,"y":212},{"id":46,"type":"seat","name":"김재형","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":316,"y":212},{"id":47,"type":"seat","name":"정태양","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":375,"y":212},{"id":48,"type":"seat","name":"이은비","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":256},{"id":49,"type":"seat","name":"김은진","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":227,"y":256},{"id":50,"type":"seat","name":"김종학","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":316,"y":256},{"id":51,"type":"seat","name":"허유빈","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":375,"y":256},{"id":52,"type":"seat","name":"이윤수","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":464,"y":256},{"id":53,"type":"seat","name":"신건우","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":300},{"id":54,"type":"seat","name":"조성해","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":227,"y":300},{"id":55,"type":"seat","name":"권소영","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":316,"y":300},{"id":56,"type":"seat","name":"김보연","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":375,"y":300},{"id":57,"type":"seat","name":"권두환","rotation":0,"color":"#8b5cf6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":464,"y":300}],"zones":[]},{"id":"F6","displayName":"6층 (개발/경영)","items":[{"id":58,"type":"seat","name":"최오성","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":449,"y":20},{"id":59,"type":"seat","name":"최성욱","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":20},{"id":60,"type":"seat","name":"최선우","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":20},{"id":61,"type":"seat","name":"유별라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":962,"y":20},{"id":62,"type":"seat","name":"임보라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1021,"y":20},{"id":63,"type":"seat","name":"김화영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1125,"y":20},{"id":64,"type":"seat","name":"김신혜","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1184,"y":20},{"id":65,"type":"seat","name":"안승호","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":64},{"id":66,"type":"seat","name":"김혁진","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":247,"y":64},{"id":67,"type":"seat","name":"장지웅","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":449,"y":64},{"id":68,"type":"seat","name":"박환용","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":64},{"id":69,"type":"seat","name":"김민찬","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":64},{"id":70,"type":"seat","name":"최성민","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":676,"y":64},{"id":71,"type":"seat","name":"김성","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":735,"y":64},{"id":72,"type":"seat","name":"문다슬","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":878,"y":64},{"id":73,"type":"seat","name":"박진용","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":962,"y":64},{"id":74,"type":"seat","name":"정지현","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1021,"y":64},{"id":75,"type":"seat","name":"서지인","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1125,"y":64},{"id":76,"type":"seat","name":"김서을","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1243,"y":64},{"id":77,"type":"seat","name":"최호준","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":108},{"id":78,"type":"seat","name":"이세영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":108},{"id":79,"type":"seat","name":"박진곤","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":247,"y":108},{"id":80,"type":"seat","name":"조태현","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":306,"y":108},{"id":81,"type":"seat","name":"김정은","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":390,"y":108},{"id":82,"type":"seat","name":"조용호","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":449,"y":108},{"id":83,"type":"seat","name":"김동훈","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":108},{"id":84,"type":"seat","name":"김승환","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":108},{"id":85,"type":"seat","name":"김원학","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":676,"y":108},{"id":86,"type":"seat","name":"백승열","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":735,"y":108},{"id":87,"type":"seat","name":"주건영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":819,"y":108},{"id":88,"type":"seat","name":"신서아","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":878,"y":108},{"id":89,"type":"seat","name":"고민서","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":962,"y":108},{"id":90,"type":"seat","name":"김유라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1021,"y":108},{"id":91,"type":"seat","name":"이재원","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1125,"y":108},{"id":92,"type":"seat","name":"공유라","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1184,"y":108},{"id":93,"type":"seat","name":"허인지","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1243,"y":108},{"id":94,"type":"seat","name":"박성진","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":192},{"id":95,"type":"seat","name":"문정인","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":104,"y":192},{"id":96,"type":"seat","name":"최기원","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":306,"y":192},{"id":97,"type":"seat","name":"이동석","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":390,"y":192},{"id":98,"type":"seat","name":"정구연","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":104,"y":236},{"id":99,"type":"seat","name":"채준","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":236},{"id":100,"type":"seat","name":"김대현","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":247,"y":236},{"id":101,"type":"seat","name":"강주영","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":306,"y":236},{"id":102,"type":"seat","name":"이민선","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":390,"y":236},{"id":103,"type":"seat","name":"배현준","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":104,"y":280},{"id":104,"type":"seat","name":"하동익","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":280},{"id":105,"type":"seat","name":"안기수","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":247,"y":280},{"id":106,"type":"seat","name":"조화평","rotation":0,"color":"#3b82f6","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":306,"y":280},{"id":107,"type":"seat","name":"서형택","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":360},{"id":108,"type":"seat","name":"임혜리","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":360},{"id":109,"type":"seat","name":"함은비","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":360},{"id":110,"type":"seat","name":"조성훈","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":424,"y":360},{"id":111,"type":"seat","name":"김민재","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":523,"y":360},{"id":112,"type":"seat","name":"강우영","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":607,"y":360},{"id":113,"type":"seat","name":"강동우","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":893,"y":360},{"id":114,"type":"seat","name":"이상연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":952,"y":360},{"id":115,"type":"seat","name":"이준호","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1179,"y":360},{"id":116,"type":"seat","name":"손은경","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1322,"y":360},{"id":117,"type":"seat","name":"CEO","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1381,"y":360},{"id":118,"type":"seat","name":"최종성","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":404},{"id":119,"type":"seat","name":"박예령","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":404},{"id":120,"type":"seat","name":"박용현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":404},{"id":121,"type":"seat","name":"최정효","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":424,"y":404},{"id":122,"type":"seat","name":"박건호","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":607,"y":404},{"id":123,"type":"seat","name":"이상희","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":893,"y":404},{"id":124,"type":"seat","name":"송윤선","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":952,"y":404},{"id":125,"type":"seat","name":"허대균","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1179,"y":404},{"id":126,"type":"seat","name":"박근홍","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1322,"y":404},{"id":127,"type":"seat","name":"나경엽","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":478},{"id":128,"type":"seat","name":"박지윤","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":281,"y":478},{"id":129,"type":"seat","name":"장지아","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":365,"y":478},{"id":130,"type":"seat","name":"노희상","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":523,"y":478},{"id":131,"type":"seat","name":"김영욱","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":607,"y":478},{"id":132,"type":"seat","name":"이아연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":750,"y":478},{"id":133,"type":"seat","name":"김한모","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":809,"y":478},{"id":134,"type":"seat","name":"최수린","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":893,"y":478},{"id":135,"type":"seat","name":"이명준","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":952,"y":478},{"id":136,"type":"seat","name":"마예슬","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1036,"y":478},{"id":137,"type":"seat","name":"이근","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1179,"y":478},{"id":138,"type":"seat","name":"안희준","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1322,"y":478},{"id":139,"type":"seat","name":"노현수","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1381,"y":478},{"id":140,"type":"seat","name":"이기녕","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1465,"y":478},{"id":141,"type":"seat","name":"유소정","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":281,"y":522},{"id":142,"type":"seat","name":"이민재B","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":365,"y":522},{"id":143,"type":"seat","name":"이예니","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":424,"y":522},{"id":144,"type":"seat","name":"박국현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":607,"y":522},{"id":145,"type":"seat","name":"유상용","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":666,"y":522},{"id":146,"type":"seat","name":"박현준","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":750,"y":522},{"id":147,"type":"seat","name":"류혜령","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":809,"y":522},{"id":148,"type":"seat","name":"이병연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":893,"y":522},{"id":149,"type":"seat","name":"최소원","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":952,"y":522},{"id":150,"type":"seat","name":"박지연","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1036,"y":522},{"id":151,"type":"seat","name":"노근석","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1179,"y":522},{"id":152,"type":"seat","name":"허정윤","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1322,"y":522},{"id":153,"type":"seat","name":"설유진","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1381,"y":522},{"id":154,"type":"seat","name":"최영현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1465,"y":522},{"id":155,"type":"seat","name":"조혜진","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":566},{"id":156,"type":"seat","name":"신동근","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":424,"y":566},{"id":157,"type":"seat","name":"반창현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":607,"y":566},{"id":158,"type":"seat","name":"탁광진","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":750,"y":566},{"id":159,"type":"seat","name":"이동윤","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":893,"y":566},{"id":160,"type":"seat","name":"박영수","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1036,"y":566},{"id":161,"type":"seat","name":"이가은","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1179,"y":566},{"id":162,"type":"seat","name":"강문현","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1322,"y":566},{"id":163,"type":"seat","name":"고지혜","rotation":0,"color":"#06b6d4","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1381,"y":566}],"zones":[]},{"id":"F7","displayName":"7층 (SSR)","items":[{"id":164,"type":"seat","name":"강명진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":20},{"id":165,"type":"seat","name":"한유종","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":20},{"id":166,"type":"seat","name":"권나현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":449,"y":20},{"id":167,"type":"seat","name":"남현민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":20},{"id":168,"type":"seat","name":"김현호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":676,"y":20},{"id":169,"type":"seat","name":"김지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":20},{"id":170,"type":"seat","name":"김탁곤","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":20},{"id":171,"type":"seat","name":"박동연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":20},{"id":172,"type":"seat","name":"문소영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":20},{"id":173,"type":"seat","name":"소수빈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":20},{"id":174,"type":"seat","name":"류경서","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":20},{"id":175,"type":"seat","name":"성시우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":20},{"id":176,"type":"seat","name":"민성호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":20},{"id":177,"type":"seat","name":"황현정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":64},{"id":178,"type":"seat","name":"박예슬","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":64},{"id":179,"type":"seat","name":"나병한","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":64},{"id":180,"type":"seat","name":"김준범","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":64},{"id":181,"type":"seat","name":"김비오","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":390,"y":64},{"id":182,"type":"seat","name":"홍진성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":449,"y":64},{"id":183,"type":"seat","name":"김덕유","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":64},{"id":184,"type":"seat","name":"김예준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":64},{"id":185,"type":"seat","name":"정원재","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":676,"y":64},{"id":186,"type":"seat","name":"최시우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":64},{"id":187,"type":"seat","name":"방아정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":64},{"id":188,"type":"seat","name":"강지은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":64},{"id":189,"type":"seat","name":"김창현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":64},{"id":190,"type":"seat","name":"박지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":64},{"id":191,"type":"seat","name":"형성찬","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":64},{"id":192,"type":"seat","name":"김시나","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":64},{"id":193,"type":"seat","name":"김해리","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":64},{"id":194,"type":"seat","name":"엄지손","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":64},{"id":195,"type":"seat","name":"이용준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":108},{"id":196,"type":"seat","name":"이승훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":108},{"id":197,"type":"seat","name":"장이국","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":163,"y":108},{"id":198,"type":"seat","name":"위지영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":108},{"id":199,"type":"seat","name":"허준희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":449,"y":108},{"id":200,"type":"seat","name":"김지수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":108},{"id":201,"type":"seat","name":"조민혁","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":108},{"id":202,"type":"seat","name":"서동주","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":676,"y":108},{"id":203,"type":"seat","name":"김주연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":108},{"id":204,"type":"seat","name":"이현희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":108},{"id":205,"type":"seat","name":"고효정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":108},{"id":206,"type":"seat","name":"이주형","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":108},{"id":207,"type":"seat","name":"김주진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":108},{"id":208,"type":"seat","name":"차석운","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":108},{"id":209,"type":"seat","name":"최원석","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":108},{"id":210,"type":"seat","name":"김민제","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":108},{"id":211,"type":"seat","name":"이민우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":108},{"id":212,"type":"seat","name":"김호진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":108},{"id":213,"type":"seat","name":"이재훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":108},{"id":214,"type":"seat","name":"부혜진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":172},{"id":215,"type":"seat","name":"김지원B","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":172},{"id":216,"type":"seat","name":"서현성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":172},{"id":217,"type":"seat","name":"염승화","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":172},{"id":218,"type":"seat","name":"전홍집","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":172},{"id":219,"type":"seat","name":"오정훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":172},{"id":220,"type":"seat","name":"박준식","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":172},{"id":221,"type":"seat","name":"나동원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":172},{"id":222,"type":"seat","name":"정진영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":172},{"id":223,"type":"seat","name":"김은성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":172},{"id":224,"type":"seat","name":"박다유","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":172},{"id":225,"type":"seat","name":"장은준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":182},{"id":226,"type":"seat","name":"최현지","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":182},{"id":227,"type":"seat","name":"이현정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":182},{"id":228,"type":"seat","name":"이동우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":306,"y":182},{"id":229,"type":"seat","name":"김소라","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":182},{"id":230,"type":"seat","name":"신성우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":182},{"id":231,"type":"seat","name":"박성진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":676,"y":182},{"id":232,"type":"seat","name":"서주희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":770,"y":182},{"id":233,"type":"seat","name":"김하연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":216},{"id":234,"type":"seat","name":"탁다운","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":216},{"id":235,"type":"seat","name":"이은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":216},{"id":236,"type":"seat","name":"김동재","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":216},{"id":237,"type":"seat","name":"이민정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":216},{"id":238,"type":"seat","name":"한지현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":216},{"id":239,"type":"seat","name":"박나래","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":216},{"id":240,"type":"seat","name":"이민지","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":216},{"id":241,"type":"seat","name":"최호준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":20,"y":226},{"id":242,"type":"seat","name":"이준수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":79,"y":226},{"id":243,"type":"seat","name":"김현진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":222,"y":226},{"id":244,"type":"seat","name":"조하영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":306,"y":226},{"id":245,"type":"seat","name":"유영호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":226},{"id":246,"type":"seat","name":"류근우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":592,"y":226},{"id":247,"type":"seat","name":"남궁호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":770,"y":226},{"id":248,"type":"seat","name":"김지민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":829,"y":226},{"id":249,"type":"seat","name":"고병호","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":533,"y":270},{"id":250,"type":"seat","name":"김수연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":257,"y":300},{"id":251,"type":"seat","name":"배지환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":479,"y":300},{"id":252,"type":"seat","name":"홍성우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":765,"y":300},{"id":253,"type":"seat","name":"한미현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":824,"y":300},{"id":254,"type":"seat","name":"최지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1051,"y":300},{"id":255,"type":"seat","name":"하헌영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1110,"y":300},{"id":256,"type":"seat","name":"신재희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1337,"y":300},{"id":257,"type":"seat","name":"임한규","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":257,"y":344},{"id":258,"type":"seat","name":"엄홍주","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":479,"y":344},{"id":259,"type":"seat","name":"이지수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":538,"y":344},{"id":260,"type":"seat","name":"황명윤","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":765,"y":344},{"id":261,"type":"seat","name":"임효선","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":824,"y":344},{"id":262,"type":"seat","name":"오승완","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1051,"y":344},{"id":263,"type":"seat","name":"김수진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1110,"y":344},{"id":264,"type":"seat","name":"김건욱","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1337,"y":344},{"id":265,"type":"seat","name":"최웅환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":257,"y":388},{"id":266,"type":"seat","name":"배제성","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":479,"y":388},{"id":267,"type":"seat","name":"이수경","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":538,"y":388},{"id":268,"type":"seat","name":"탁예은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":765,"y":388},{"id":269,"type":"seat","name":"박고은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":824,"y":388},{"id":270,"type":"seat","name":"하정현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1051,"y":388},{"id":271,"type":"seat","name":"이현아","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1110,"y":388},{"id":272,"type":"seat","name":"유별라","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1337,"y":388},{"id":273,"type":"seat","name":"이용철","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":257,"y":432},{"id":274,"type":"seat","name":"이찬영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":479,"y":432},{"id":275,"type":"seat","name":"이나레","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":538,"y":432},{"id":276,"type":"seat","name":"민소영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":765,"y":432},{"id":277,"type":"seat","name":"조윤진","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":824,"y":432},{"id":278,"type":"seat","name":"장시은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1051,"y":432},{"id":279,"type":"seat","name":"박종철","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1110,"y":432},{"id":280,"type":"seat","name":"박상우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1337,"y":432},{"id":281,"type":"seat","name":"이성수","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":496},{"id":282,"type":"seat","name":"김민섭","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":496},{"id":283,"type":"seat","name":"안성범","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":496},{"id":284,"type":"seat","name":"이승원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":496},{"id":285,"type":"seat","name":"조홍래","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":496},{"id":286,"type":"seat","name":"김동민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":496},{"id":287,"type":"seat","name":"이창현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":496},{"id":288,"type":"seat","name":"홍다운","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":496},{"id":289,"type":"seat","name":"장한솔","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":496},{"id":290,"type":"seat","name":"이은서","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":496},{"id":291,"type":"seat","name":"김문형","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":496},{"id":292,"type":"seat","name":"조간섭","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":540},{"id":293,"type":"seat","name":"김민경","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":540},{"id":294,"type":"seat","name":"성주녕","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":540},{"id":295,"type":"seat","name":"정유경","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":540},{"id":296,"type":"seat","name":"이지원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":540},{"id":297,"type":"seat","name":"손현목","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":540},{"id":298,"type":"seat","name":"남예림","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":540},{"id":299,"type":"seat","name":"곽은정","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":540},{"id":300,"type":"seat","name":"이현동","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":540},{"id":301,"type":"seat","name":"유정훈","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":540},{"id":302,"type":"seat","name":"김찬우","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":540},{"id":303,"type":"seat","name":"이재현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":584},{"id":304,"type":"seat","name":"최원천","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":584},{"id":305,"type":"seat","name":"위수현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":584},{"id":306,"type":"seat","name":"원종영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":584},{"id":307,"type":"seat","name":"김기범","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":584},{"id":308,"type":"seat","name":"구자영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":584},{"id":309,"type":"seat","name":"정미아","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":584},{"id":310,"type":"seat","name":"김다은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":584},{"id":311,"type":"seat","name":"정윤희","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":584},{"id":312,"type":"seat","name":"최승현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":584},{"id":313,"type":"seat","name":"이정환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":584},{"id":314,"type":"seat","name":"박혜민","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":628},{"id":315,"type":"seat","name":"표세준","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":114,"y":628},{"id":316,"type":"seat","name":"전영철","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":173,"y":628},{"id":317,"type":"seat","name":"이진원","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":628},{"id":318,"type":"seat","name":"김민석","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":628},{"id":319,"type":"seat","name":"하병찬","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":628},{"id":320,"type":"seat","name":"지연님","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":681,"y":628},{"id":321,"type":"seat","name":"강다은","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":908,"y":628},{"id":322,"type":"seat","name":"유상용","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":967,"y":628},{"id":323,"type":"seat","name":"차재현","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1194,"y":628},{"id":324,"type":"seat","name":"이유미","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":1253,"y":628},{"id":325,"type":"seat","name":"박새별","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":40,"y":672},{"id":326,"type":"seat","name":"허원영","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":336,"y":672},{"id":327,"type":"seat","name":"공지환","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":395,"y":672},{"id":328,"type":"seat","name":"김세연","rotation":0,"color":"#10b981","textColor":"#ffffff","opacity":1,"textOpacity":1,"width":30,"height":60,"x":622,"y":672}],"zones":[]}],"activeFloorId":"F5","appTitle":"슈퍼크리에이티브 배치도","colorGroupNames":{},"colorGroupOrder":[],"customPalette":[]} as const;

const miS:React.CSSProperties={width:"100%",padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
const okBtnS:React.CSSProperties={padding:"10px 24px",backgroundColor:"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:700};
const cxBtnS:React.CSSProperties={padding:"10px 24px",border:"1px solid #e2e8f0",borderRadius:"8px",cursor:"pointer",fontSize:"13px",color:"#64748b",backgroundColor:"#f8fafc"};
const addBtnS=(bg:string,color:string,border:string):React.CSSProperties=>({width:"100%",padding:"8px 12px",backgroundColor:bg,color,border:`1px solid ${border}`,borderRadius:"8px",fontWeight:700,cursor:"pointer",fontSize:"12px",marginBottom:"4px",textAlign:"left"});
const pcS:React.CSSProperties={padding:"11px",border:"1px solid #f1f5f9",borderRadius:"10px",marginBottom:"8px",backgroundColor:"#fafafa"};
const slS:React.CSSProperties={fontSize:"10px",color:"#94a3b8",display:"block",marginBottom:"7px",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.5px"};
const inS:React.CSSProperties={width:"100%",padding:"6px 8px",border:"1px solid #e2e8f0",borderRadius:"6px",fontSize:"12px",boxSizing:"border-box" as const,outline:"none",backgroundColor:"#fff"};
const tbBtnS:React.CSSProperties={padding:"6px 12px",backgroundColor:"#fff",border:"1px solid #e2e8f0",borderRadius:"20px",cursor:"pointer",fontSize:"11px",fontWeight:600,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",color:"#475569"};

export default function SeatMapSystem() {
  const [hasMounted,setHasMounted]=useState(false);
  const [appTitle,setAppTitle]=useState<string>(INITIAL_DATA.appTitle as string);
  const [isAdmin,setIsAdmin]=useState(false);
  const [adminPassword,setAdminPassword]=useState("1234");
  const [floors,setFloors]=useState<FloorInfo[]>(INITIAL_DATA.floors as unknown as FloorInfo[]);
  const [activeFloorId,setActiveFloorId]=useState<string>(INITIAL_DATA.activeFloorId as string);
  const [selectedIds,setSelectedIds]=useState<number[]>([]);
  const [selectedZoneId,setSelectedZoneId]=useState<number|null>(null);
  const [undoHistory,setUndoHistory]=useState<FloorInfo[][]>([]);
  const [departments]=useState<Department[]>([
    {id:"d1",name:"기획",color:"#3b82f6"},{id:"d2",name:"개발",color:"#10b981"},
    {id:"d3",name:"디자인",color:"#8b5cf6"},{id:"d4",name:"영업",color:"#f59e0b"},
    {id:"d5",name:"인사",color:"#ef4444"},{id:"d6",name:"재무",color:"#06b6d4"},
    {id:"d7",name:"기타",color:"#64748b"},
  ]);
  const [colorGroupNames,setColorGroupNames]=useState<Record<string,string>>({});
  const [colorGroupOrder,setColorGroupOrder]=useState<string[]>([]);
  const [customPalette,setCustomPalette]=useState<string[]>([]);
  const [editingColorHex,setEditingColorHex]=useState<string|null>(null);
  const [modal,setModal]=useState<"login"|"changePw"|"saveVersion"|null>(null);
  const [mInput,setMInput]=useState("");
  const [mErr,setMErr]=useState("");
  const [versionLabel,setVersionLabel]=useState("");
  const [versions,setVersions]=useState<VersionSnapshot[]>([]);
  const [sideTab,setSideTab]=useState<"floors"|"versions"|"shortcuts">("floors");
  const [editingFloorId,setEditingFloorId]=useState<string|null>(null);
  const [editingFloorName,setEditingFloorName]=useState("");
  const [boxSel,setBoxSel]=useState<{sx:number;sy:number;ex:number;ey:number}|null>(null);
  const isBoxing=useRef(false);
  const [zoom,setZoom]=useState(0.7);
  const [pan,setPan]=useState({x:0,y:0});
  const isPanning=useRef(false);
  const panStart=useRef({x:0,y:0,px:0,py:0});
  const viewportRef=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLDivElement>(null);
  const pickRef=useRef<HTMLInputElement>(null);
  const deptDragIdx=useRef<number|null>(null);
  const clipboard=useRef<RoomItem[]>([]);
  const [emptyHighlight,setEmptyHighlight]=useState(false);
  const [zoneDrawMode,setZoneDrawMode]=useState(false);
  const [zoneVisible,setZoneVisible]=useState(true);
  const [zoneDrawing,setZoneDrawing]=useState<{sx:number;sy:number;ex:number;ey:number}|null>(null);
  const isZoneDrawing=useRef(false);
  const [snapGuides,setSnapGuides]=useState<{x?:number;y?:number}>({});
  const [overlappingIds,setOverlappingIds]=useState<Set<number>>(new Set());
  const [allowOverlap,setAllowOverlap]=useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResults,setSearchResults]=useState<{floorId:string;floorName:string;item:RoomItem}[]>([]);
  const [searchHighlightId,setSearchHighlightId]=useState<number|null>(null);
  const [saveStatus,setSaveStatus]=useState<"idle"|"saving"|"saved"|"error">("idle");

  useEffect(()=>{setHasMounted(true);},[]);
  useEffect(()=>{document.title=appTitle;},[appTitle]);

  // 휠 줌
  useEffect(()=>{
    const fn=(e:WheelEvent)=>{
      if(!viewportRef.current?.contains(e.target as Node))return;
      e.preventDefault();
      setZoom(z=>Math.min(2,Math.max(0.2,z*(e.deltaY>0?0.9:1.1))));
    };
    document.addEventListener("wheel",fn,{passive:false});
    return()=>document.removeEventListener("wheel",fn);
  },[]);

  // 서버 불러오기
  useEffect(()=>{
    fetch("/api/load").then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{
      if(!data)return;
      if(data.colorGroupNames)setColorGroupNames(data.colorGroupNames);
      if(data.colorGroupOrder)setColorGroupOrder(data.colorGroupOrder);
      if(data.customPalette)setCustomPalette(data.customPalette);
    }).catch(()=>{});
  },[]);

  // 저장
  const handleSaveToServer=useCallback(async()=>{
    setSaveStatus("saving");
    try{
      const res=await fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({floors,activeFloorId,appTitle,colorGroupNames,colorGroupOrder,customPalette})});
      if(!res.ok)throw new Error();
      setSaveStatus("saved");setTimeout(()=>setSaveStatus("idle"),2000);
    }catch{setSaveStatus("error");setTimeout(()=>setSaveStatus("idle"),2000);}
  },[floors,activeFloorId,appTitle,colorGroupNames,colorGroupOrder,customPalette]);

  const curFloor=useMemo(()=>floors.find(f=>f.id===activeFloorId)||floors[0],[floors,activeFloorId]);
  const curItems=useMemo(()=>curFloor?.items||[],[curFloor]);
  const curZones=useMemo(()=>curFloor?.zones||[],[curFloor]);

  const allSeats=useMemo(()=>floors.flatMap(f=>f.items.filter(i=>i.type==="seat")),[floors]);
  const activeColorGroups=useMemo(()=>{
    const map=new Map<string,{hex:string;name:string;count:number;emptyCount:number}>();
    curItems.filter(i=>i.type==="seat").forEach(i=>{
      const hex=colorToHex(i.color);
      if(!map.has(hex))map.set(hex,{hex,name:colorGroupNames[hex]||"",count:0,emptyCount:0});
      const g=map.get(hex)!;g.count++;
      if(!i.name||i.name==="새 좌석"||i.name.trim()==="")g.emptyCount++;
    });
    const sorted=Array.from(map.values());
    if(colorGroupOrder.length){sorted.sort((a,b)=>{const ai=colorGroupOrder.indexOf(a.hex),bi=colorGroupOrder.indexOf(b.hex);if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi;});}
    return sorted;
  },[curItems,colorGroupNames,colorGroupOrder]);

  const totalSeats=useMemo(()=>curItems.filter(i=>i.type==="seat").length,[curItems]);
  const emptySeats=useMemo(()=>curItems.filter(i=>i.type==="seat"&&(!i.name||i.name==="새 좌석"||i.name.trim()==="")),[curItems]);

  const saveHistory=useCallback(()=>setUndoHistory(p=>[...p.slice(-29),JSON.parse(JSON.stringify(floors))]),[floors]);

  const updateItems=useCallback((newItems:RoomItem[])=>{
    setFloors(p=>p.map(f=>f.id===activeFloorId?{...f,items:newItems}:f));
    if(allowOverlap){setOverlappingIds(new Set());return;}
    const ov=new Set<number>();
    for(let i=0;i<newItems.length;i++)for(let j=i+1;j<newItems.length;j++)
      if(isOverlapping(newItems[i],newItems[j])&&newItems[i].type==="seat"&&newItems[j].type==="seat"){ov.add(newItems[i].id);ov.add(newItems[j].id);}
    setOverlappingIds(ov);
  },[activeFloorId,allowOverlap]);

  const updateZones=useCallback((newZones:Zone[])=>{setFloors(p=>p.map(f=>f.id===activeFloorId?{...f,zones:newZones}:f));},[activeFloorId]);

  const addItem=(type:ItemType)=>{
    saveHistory();
    const id=Date.now();
    const col=type==="seat"?departments[0].color:type==="wall"?"#475569":type==="space"?"#e2e8f0":"#64748b";
    const name=type==="seat"?"새 좌석":type==="wall"?"":type==="space"?"공간":"출입문";
    const w=type==="wall"?150:type==="door"?60:type==="space"?200:30;
    const h=type==="wall"?12:type==="door"?60:type==="space"?120:60;
    updateItems([...curItems,{id,type,name,rotation:0,color:col,textColor:type==="space"?"#475569":"#ffffff",opacity:1,textOpacity:1,width:w,height:h,x:130,y:130}]);
    setSelectedIds([id]);
  };

  const addFloor=()=>{const id=`F${Date.now()}`;setFloors(p=>[...p,emptyFloor(id,`${p.length+1}층`)]);setActiveFloorId(id);};
  const deleteFloor=(fid:string)=>{if(floors.length<=1)return;setFloors(p=>p.filter(f=>f.id!==fid));setActiveFloorId(p=>{const rem=floors.filter(f=>f.id!==fid);return p===fid?(rem[0]?.id||""):p;});};
  const selectAll=()=>setSelectedIds(curItems.map(i=>i.id));
  const selectByColor=(color:string)=>setSelectedIds(curItems.filter(i=>colorToHex(i.color)===color).map(i=>i.id));
  const duplicateSelected=useCallback(()=>{
    if(!selectedIds.length)return;saveHistory();
    const newIds:number[]=[];
    const duped=curItems.filter(i=>selectedIds.includes(i.id)).map(i=>{const nid=Date.now()+Math.floor(Math.random()*99999);newIds.push(nid);return{...i,id:nid,x:i.x+20,y:i.y+20};});
    updateItems([...curItems,...duped]);setSelectedIds(newIds);
  },[selectedIds,curItems,saveHistory,updateItems]);
  const handleExport=useCallback(()=>{if(canvasRef.current)exportToPNG(canvasRef.current,appTitle,curFloor.displayName);},[appTitle,curFloor]);

  const handleSearch=useCallback((q:string)=>{
    setSearchQuery(q);
    if(!q.trim()){setSearchResults([]);return;}
    const results:{floorId:string;floorName:string;item:RoomItem}[]=[];
    floors.forEach(f=>f.items.filter(i=>i.type==="seat"&&i.name&&i.name.includes(q.trim())).forEach(i=>results.push({floorId:f.id,floorName:f.displayName,item:i})));
    setSearchResults(results);
  },[floors]);

  const handleSearchResultClick=useCallback((floorId:string,itemId:number)=>{
    setActiveFloorId(floorId);setSearchHighlightId(itemId);setSearchQuery("");setSearchResults([]);
    setTimeout(()=>setSearchHighlightId(null),3000);
  },[]);

  const getCanvasPos=(e:React.MouseEvent|MouseEvent)=>{
    if(!viewportRef.current)return{x:0,y:0};
    const r=viewportRef.current.getBoundingClientRect();
    return{x:(e.clientX-r.left-pan.x)/zoom,y:(e.clientY-r.top-pan.y)/zoom};
  };

  const handleCanvasMouseDown=(e:React.MouseEvent<HTMLDivElement>)=>{
    const target=e.target as HTMLElement;
    const isOnItem=target.closest("[data-item]");
    const isOnZone=target.closest("[data-zone]");
    if(!isAdmin){if(!isOnItem&&!isOnZone)setSelectedIds([]);return;}
    if(zoneDrawMode){const{x,y}=getCanvasPos(e);isZoneDrawing.current=true;setZoneDrawing({sx:x,sy:y,ex:x,ey:y});isPanning.current=false;return;}
    if(!isOnItem&&!isOnZone){const{x,y}=getCanvasPos(e);isBoxing.current=true;isPanning.current=false;setBoxSel({sx:x,sy:y,ex:x,ey:y});setSelectedIds([]);setSelectedZoneId(null);}
  };
  const handleCanvasMouseMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(isZoneDrawing.current){const{x,y}=getCanvasPos(e);setZoneDrawing(p=>p?{...p,ex:x,ey:y}:null);}
    else if(isBoxing.current){const{x,y}=getCanvasPos(e);setBoxSel(p=>p?{...p,ex:x,ey:y}:null);}
  };
  const handleCanvasMouseUp=()=>{
    if(isZoneDrawing.current&&zoneDrawing){
      isZoneDrawing.current=false;
      const x=Math.min(zoneDrawing.sx,zoneDrawing.ex),y=Math.min(zoneDrawing.sy,zoneDrawing.ey);
      const w=Math.abs(zoneDrawing.ex-zoneDrawing.sx),h=Math.abs(zoneDrawing.ey-zoneDrawing.sy);
      if(w>30&&h>30){saveHistory();const nz:Zone={id:Date.now(),name:"새 구역",color:"#3b82f6",x,y,width:w,height:h};updateZones([...curZones,nz]);setSelectedZoneId(nz.id);setSelectedIds([]);}
      setZoneDrawing(null);setZoneDrawMode(false);return;
    }
    if(isBoxing.current&&boxSel){
      isBoxing.current=false;
      const sl=Math.min(boxSel.sx,boxSel.ex),sr=Math.max(boxSel.sx,boxSel.ex);
      const st=Math.min(boxSel.sy,boxSel.ey),sb=Math.max(boxSel.sy,boxSel.ey);
      if(sr-sl>5&&sb-st>5)setSelectedIds(curItems.filter(i=>i.x<sr&&i.x+i.width>sl&&i.y<sb&&i.y+i.height>st).map(i=>i.id));
      setBoxSel(null);
    }
    isBoxing.current=false;
  };

  // ── 단축키 ──────────────────────────────────────────────────
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(!isAdmin)return;
      const tag=(document.activeElement as HTMLElement)?.tagName;
      const inInput=tag==="INPUT"||tag==="TEXTAREA";
      const ctrl=e.ctrlKey||e.metaKey;
      if(ctrl&&e.key==="z"){e.preventDefault();if(undoHistory.length){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));}return;}
      if(ctrl&&e.key==="d"){if(inInput)return;e.preventDefault();duplicateSelected();return;}
      if(ctrl&&e.key==="a"){if(inInput)return;e.preventDefault();selectAll();return;}
      if(e.key==="Escape"){setZoneDrawMode(false);isZoneDrawing.current=false;setZoneDrawing(null);return;}
      if((e.key==="Delete"||e.key==="Backspace")&&!inInput){
        if(selectedZoneId!==null){saveHistory();updateZones(curZones.filter(z=>z.id!==selectedZoneId));setSelectedZoneId(null);}
        else if(selectedIds.length){saveHistory();updateItems(curItems.filter(i=>!selectedIds.includes(i.id)));setSelectedIds([]);}
        return;
      }
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selectedIds.length&&!inInput){
        e.preventDefault();const s=e.shiftKey?10:1;
        const dx=e.key==="ArrowLeft"?-s:e.key==="ArrowRight"?s:0;
        const dy=e.key==="ArrowUp"?-s:e.key==="ArrowDown"?s:0;
        updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,x:i.x+dx,y:i.y+dy}:i));return;
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[isAdmin,undoHistory,selectedIds,selectedZoneId,curItems,curZones,duplicateSelected,saveHistory,updateItems,updateZones,selectAll]);

  if(!hasMounted)return null;
  const selZone=curZones.find(z=>z.id===selectedZoneId);
  const selItems=curItems.filter(i=>selectedIds.includes(i.id));

  return(
    <main style={{display:"flex",height:"100vh",backgroundColor:"#f1f5f9",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif"}}>

      {/* ── 모달 ── */}
      {modal&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.45)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:3000,backdropFilter:"blur(4px)"}}>
          <div style={{backgroundColor:"#fff",padding:"28px 24px",borderRadius:"16px",width:"320px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
            {modal==="login"&&<>
              <div style={{fontSize:"26px",marginBottom:"6px"}}>🔐</div>
              <h3 style={{fontWeight:700,fontSize:"15px",marginBottom:"14px",color:"#1e293b"}}>관리자 로그인</h3>
              <input type="password" value={mInput} onChange={e=>{setMInput(e.target.value);setMErr("");}} onKeyDown={e=>{if(e.key==="Enter"){if(mInput===adminPassword){setIsAdmin(true);setModal(null);}else setMErr("비밀번호가 틀렸습니다");setMInput("");}}} placeholder="비밀번호 입력" style={miS} autoFocus/>
              {mErr&&<p style={{color:"#ef4444",fontSize:"12px",marginTop:"6px"}}>{mErr}</p>}
              <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"14px"}}>
                <button onClick={()=>{if(mInput===adminPassword){setIsAdmin(true);setModal(null);}else{setMErr("비밀번호가 틀렸습니다");setMInput("");}}} style={okBtnS}>확인</button>
                <button onClick={()=>{setModal(null);setMInput("");setMErr("");}} style={cxBtnS}>취소</button>
              </div>
            </>}
            {modal==="changePw"&&<>
              <div style={{fontSize:"26px",marginBottom:"6px"}}>🔑</div>
              <h3 style={{fontWeight:700,fontSize:"15px",marginBottom:"14px",color:"#1e293b"}}>비밀번호 변경</h3>
              <input type="password" value={mInput} onChange={e=>{setMInput(e.target.value);setMErr("");}} placeholder="새 비밀번호" style={miS}/>
              {mErr&&<p style={{color:"#ef4444",fontSize:"12px",marginTop:"6px"}}>{mErr}</p>}
              <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"14px"}}>
                <button onClick={()=>{if(mInput.length<4){setMErr("4자 이상 입력하세요");}else{setAdminPassword(mInput);setModal(null);setMInput("");}}} style={okBtnS}>변경</button>
                <button onClick={()=>{setModal(null);setMInput("");setMErr("");}} style={cxBtnS}>취소</button>
              </div>
            </>}
            {modal==="saveVersion"&&<>
              <div style={{fontSize:"26px",marginBottom:"6px"}}>💾</div>
              <h3 style={{fontWeight:700,fontSize:"15px",marginBottom:"14px",color:"#1e293b"}}>버전 저장</h3>
              <input value={versionLabel} onChange={e=>setVersionLabel(e.target.value)} placeholder="버전 이름 (예: 3월 배치)" style={miS} autoFocus/>
              <div style={{display:"flex",gap:"8px",justifyContent:"center",marginTop:"14px"}}>
                <button onClick={()=>{if(!versionLabel.trim())return;setVersions(p=>[...p,{id:Date.now().toString(),label:versionLabel.trim(),savedAt:new Date().toLocaleDateString("ko-KR"),floors:JSON.parse(JSON.stringify(floors))}]);setVersionLabel("");setModal(null);}} style={okBtnS}>저장</button>
                <button onClick={()=>{setModal(null);setVersionLabel("");}} style={cxBtnS}>취소</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* ── 사이드바 ── */}
      <div style={{width:"210px",backgroundColor:"#fff",padding:"14px",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",gap:"6px",overflowY:"auto",boxShadow:"2px 0 8px rgba(0,0,0,0.04)"}}>
        {isAdmin?<input value={appTitle} onChange={e=>setAppTitle(e.target.value)} style={{fontSize:"13px",fontWeight:800,border:"2px solid #2563eb",borderRadius:"8px",width:"100%",marginBottom:"4px",padding:"6px 8px",boxSizing:"border-box"}}/>
          :<h2 style={{fontWeight:800,fontSize:"13px",marginBottom:"4px",color:"#1e293b"}}>{appTitle}</h2>}

        {/* 검색 */}
        <div style={{position:"relative",marginBottom:"6px"}}>
          <input value={searchQuery} onChange={e=>handleSearch(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&searchResults.length>0)handleSearchResultClick(searchResults[0].floorId,searchResults[0].item.id);if(e.key==="Escape"){setSearchQuery("");setSearchResults([]);}}}
            placeholder="🔍 이름 검색... (Enter)" style={{width:"100%",padding:"7px 10px",border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"12px",boxSizing:"border-box",outline:"none"}}/>
          {searchResults.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,backgroundColor:"#fff",border:"1px solid #e2e8f0",borderRadius:"8px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:1000,maxHeight:"200px",overflowY:"auto",marginTop:"4px"}}>
              {searchResults.map((r,i)=>(
                <div key={i} onClick={()=>handleSearchResultClick(r.floorId,r.item.id)}
                  style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onMouseEnter={e=>(e.currentTarget.style.backgroundColor="#f8fafc")}
                  onMouseLeave={e=>(e.currentTarget.style.backgroundColor="#fff")}>
                  <span style={{fontWeight:700,fontSize:"12px",color:"#1e293b"}}>{r.item.name}</span>
                  <span style={{fontSize:"10px",color:"#94a3b8",backgroundColor:"#f1f5f9",padding:"2px 6px",borderRadius:"4px"}}>{r.floorName}</span>
                </div>
              ))}
            </div>
          )}
          {searchQuery&&searchResults.length===0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,backgroundColor:"#fff",border:"1px solid #e2e8f0",borderRadius:"8px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:1000,padding:"12px",textAlign:"center",color:"#94a3b8",fontSize:"12px",marginTop:"4px"}}>검색 결과 없음</div>
          )}
        </div>

        {/* 층 버튼 */}
        <div style={{display:"flex",flexDirection:"column",gap:"3px",marginBottom:"6px"}}>
          {floors.map(f=>(
            <div key={f.id} style={{display:"flex",alignItems:"center",gap:"4px"}}>
              {isAdmin&&editingFloorId===f.id
                ?<input value={editingFloorName} onChange={e=>setEditingFloorName(e.target.value)}
                    onBlur={()=>{if(editingFloorName.trim())setFloors(p=>p.map(fl=>fl.id===f.id?{...fl,displayName:editingFloorName.trim()}:fl));setEditingFloorId(null);}}
                    onKeyDown={e=>{if(e.key==="Enter"){if(editingFloorName.trim())setFloors(p=>p.map(fl=>fl.id===f.id?{...fl,displayName:editingFloorName.trim()}:fl));setEditingFloorId(null);}}}
                    style={{flex:1,padding:"5px 8px",border:"2px solid #2563eb",borderRadius:"6px",fontSize:"12px",outline:"none"}} autoFocus/>
                :<button onClick={()=>setActiveFloorId(f.id)}
                    onDoubleClick={()=>{if(isAdmin){setEditingFloorId(f.id);setEditingFloorName(f.displayName);}}}
                    style={{flex:1,padding:"7px 10px",backgroundColor:f.id===activeFloorId?"#2563eb":"#f8fafc",color:f.id===activeFloorId?"#fff":"#374151",border:f.id===activeFloorId?"none":"1px solid #e2e8f0",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:f.id===activeFloorId?700:500,textAlign:"left"}}>
                    {f.displayName}
                  </button>
              }
              {isAdmin&&<button onClick={()=>deleteFloor(f.id)} style={{padding:"4px 7px",backgroundColor:"#fff",color:"#ef4444",border:"1px solid #fecaca",borderRadius:"6px",cursor:"pointer",fontSize:"10px"}}>✕</button>}
            </div>
          ))}
          {isAdmin&&<button onClick={addFloor} style={{padding:"7px",backgroundColor:"#f0fdf4",color:"#059669",border:"1px solid #d1fae5",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:600}}>+ 층 추가</button>}
        </div>

        {isAdmin&&<>
          {/* 탭 */}
          <div style={{display:"flex",gap:"3px",marginBottom:"6px"}}>
            {(([["floors","🏢 통계"],["versions","💾 버전"],["shortcuts","⌨️ 단축키"]] as ["floors"|"versions"|"shortcuts",string][]).map(([k,lbl])=>(
              <button key={k} onClick={()=>setSideTab(k)} style={{flex:1,padding:"5px 3px",backgroundColor:sideTab===k?"#eff6ff":"#f8fafc",color:sideTab===k?"#2563eb":"#64748b",border:sideTab===k?"1px solid #bfdbfe":"1px solid #e2e8f0",borderRadius:"6px",cursor:"pointer",fontSize:"10px",fontWeight:600}}>{lbl}</button>
            )))}
          </div>

          {sideTab==="floors"&&<>
            <div style={pcS}>
              <div style={slS}>현재 층 통계</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                <span style={{fontSize:"11px",color:"#64748b"}}>전체</span>
                <span style={{fontSize:"13px",fontWeight:800,color:"#1e293b"}}>{totalSeats}석</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                <span style={{fontSize:"11px",color:"#64748b"}}>사용중</span>
                <span style={{fontSize:"13px",fontWeight:800,color:"#10b981"}}>{totalSeats-emptySeats.length}석</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:"11px",color:"#64748b"}}>빈자리</span>
                <span style={{fontSize:"13px",fontWeight:800,color:"#f59e0b"}}>{emptySeats.length}석</span>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
              <span style={slS}>부서별</span>
              <span style={{fontSize:"9px",color:"#c0c8d6"}}>색상클릭=선택</span>
            </div>
            {activeColorGroups.map((group,idx)=>(
              <div key={group.hex} draggable onDragStart={()=>{deptDragIdx.current=idx;}} onDragOver={e=>e.preventDefault()}
                onDrop={()=>{
                  if(deptDragIdx.current===null||deptDragIdx.current===idx)return;
                  const o=[...colorGroupOrder];const fromHex=activeColorGroups[deptDragIdx.current]?.hex;
                  if(!fromHex)return;const fi=o.indexOf(fromHex),ti=o.indexOf(group.hex);
                  const allHexes=activeColorGroups.map(g=>g.hex);
                  const base=allHexes.filter(h=>o.includes(h));
                  if(fi===-1){base.splice(base.indexOf(group.hex),0,fromHex);}
                  else{const nb=[...base];const [moved]=nb.splice(fi,1);nb.splice(ti<0?0:ti,0,moved);base.splice(0,base.length,...nb);}
                  setColorGroupOrder(base);deptDragIdx.current=null;
                }}
                style={{display:"flex",alignItems:"center",gap:"7px",padding:"7px 8px",backgroundColor:"#fafafa",borderRadius:"8px",marginBottom:"3px",cursor:"pointer",border:"1px solid #f1f5f9"}}
                onClick={()=>selectByColor(group.hex)}>
                <div style={{width:"16px",height:"16px",borderRadius:"50%",backgroundColor:group.hex,flexShrink:0,border:"1.5px solid rgba(0,0,0,0.1)"}}/>
                {editingColorHex===group.hex
                  ?<input value={colorGroupNames[group.hex]||""} onChange={e=>setColorGroupNames(p=>({...p,[group.hex]:e.target.value}))}
                      onBlur={()=>setEditingColorHex(null)} onKeyDown={e=>{if(e.key==="Enter")setEditingColorHex(null);}} style={{flex:1,border:"1px solid #bfdbfe",borderRadius:"4px",padding:"2px 4px",fontSize:"11px",outline:"none"}} autoFocus onClick={e=>e.stopPropagation()}/>
                  :<span style={{flex:1,fontSize:"11px",color:"#374151",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onDoubleClick={e=>{e.stopPropagation();setEditingColorHex(group.hex);}}>{colorGroupNames[group.hex]||group.hex}</span>
                }
                <span style={{fontSize:"11px",color:"#94a3b8",flexShrink:0}}>{group.count-group.emptyCount}/{group.count}</span>
                <input ref={pickRef} type="color" style={{display:"none"}} onChange={e=>{const newHex=e.target.value;updateItems(curItems.map(i=>colorToHex(i.color)===group.hex?{...i,color:applyOpacity(newHex,colorToOpacity(i.color))}:i));}}/>
              </div>
            ))}
          </>}

          {sideTab==="versions"&&<>
            <button onClick={()=>setModal("saveVersion")} style={{width:"100%",padding:"8px",border:"1px solid #d1fae5",borderRadius:"6px",fontSize:"12px",cursor:"pointer",backgroundColor:"#ecfdf5",color:"#10b981",fontWeight:700,marginBottom:"8px"}}>💾 현재 버전 저장</button>
            {versions.length===0?<p style={{fontSize:"11px",color:"#c0c8d6",textAlign:"center",padding:"12px"}}>저장된 버전 없음</p>
              :versions.map(v=>(
                <div key={v.id} style={{padding:"8px",border:"1px solid #f1f5f9",borderRadius:"8px",marginBottom:"4px",backgroundColor:"#fafafa"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:"#1e293b",marginBottom:"3px"}}>{v.label}</div>
                  <div style={{fontSize:"10px",color:"#94a3b8",marginBottom:"6px"}}>{v.savedAt}</div>
                  <div style={{display:"flex",gap:"4px"}}>
                    <button onClick={()=>{saveHistory();setFloors(JSON.parse(JSON.stringify(v.floors)));}} style={{flex:1,padding:"4px",border:"1px solid #bfdbfe",borderRadius:"5px",fontSize:"10px",cursor:"pointer",backgroundColor:"#eff6ff",color:"#2563eb",fontWeight:600}}>복구</button>
                    <button onClick={()=>setVersions(p=>p.filter(vv=>vv.id!==v.id))} style={{padding:"4px 8px",border:"1px solid #fecaca",borderRadius:"5px",fontSize:"10px",cursor:"pointer",backgroundColor:"#fef2f2",color:"#ef4444"}}>삭제</button>
                  </div>
                </div>
              ))}
          </>}

          {sideTab==="shortcuts"&&<>
            <span style={slS}>⌨️ 단축키</span>
            {[["Ctrl+Z","되돌리기"],["Ctrl+D","복제"],["Ctrl+A","전체선택"],["Del","삭제"],["Esc","구역그리기 취소"],["←↑→↓","미세이동 1px"],["Shift+화살표","10px 이동"],["드래그(빈공간)","박스 다중선택"],["Shift+클릭","개별 추가선택"]].map(([k,d])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",borderRadius:"6px",marginBottom:"2px",backgroundColor:"#f8fafc"}}>
                <code style={{fontSize:"10px",backgroundColor:"#e2e8f0",padding:"2px 6px",borderRadius:"4px",color:"#374151",fontWeight:700}}>{k}</code>
                <span style={{fontSize:"10px",color:"#64748b"}}>{d}</span>
              </div>
            ))}
          </>}

        </>}

        {/* 스페이서 */}
        <div style={{flex:1,minHeight:"12px"}}/>

        {isAdmin&&<div style={{borderTop:"1px solid #f1f5f9",paddingTop:"10px"}}>
          <div style={slS}>추가</div>
          <button onClick={()=>addItem("seat")} style={addBtnS("#eff6ff","#2563eb","#bfdbfe")}>🪑 좌석 추가</button>
          <button onClick={()=>addItem("wall")} style={addBtnS("#f8fafc","#475569","#e2e8f0")}>🧱 벽체 추가</button>
          <button onClick={()=>addItem("door")} style={addBtnS("#f8fafc","#64748b","#e2e8f0")}>🚪 문 추가</button>
          <button onClick={()=>addItem("space")} style={addBtnS("#f0f9ff","#0ea5e9","#bae6fd")}>🏠 공간 추가</button>
          <button onClick={()=>{setZoneDrawMode(p=>!p);setSelectedIds([]);setSelectedZoneId(null);isZoneDrawing.current=false;setZoneDrawing(null);}}
            style={addBtnS(zoneDrawMode?"#fef9c3":"#fafafa",zoneDrawMode?"#b45309":"#64748b",zoneDrawMode?"#fde68a":"#e2e8f0")}>
            {zoneDrawMode?"✏️ 그리는 중... (Esc취소)":"🗂 구역 추가"}
          </button>
          <button onClick={()=>setModal("changePw")} style={{padding:"7px",width:"100%",backgroundColor:"#f8fafc",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:"7px",cursor:"pointer",fontSize:"11px",fontWeight:600,marginBottom:"6px"}}>🔑 비밀번호 변경</button>
        </div>}

        <button onClick={()=>isAdmin?setIsAdmin(false):setModal("login")}
          style={{padding:"9px",backgroundColor:isAdmin?"#1e293b":"#2563eb",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
          {isAdmin?"✅ 편집 종료":"🔐 관리자 로그인"}
        </button>
      </div>

      {/* ── 메인 영역 ── */}
      <div style={{flex:1,padding:"16px",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {/* 툴바 */}
        <div style={{display:"flex",gap:"6px",alignItems:"center",marginBottom:"8px",flexWrap:"wrap"}}>
          <button onClick={handleSaveToServer} disabled={saveStatus==="saving"}
            style={{...tbBtnS,backgroundColor:saveStatus==="saved"?"#f0fdf4":saveStatus==="error"?"#fef2f2":"#ecfdf5",color:saveStatus==="saved"?"#059669":saveStatus==="error"?"#ef4444":"#059669",border:saveStatus==="error"?"1px solid #fecaca":"1px solid #d1fae5",fontWeight:700,opacity:saveStatus==="saving"?0.6:1}}>
            {saveStatus==="saving"?"저장 중...":saveStatus==="saved"?"✅ 저장됨":saveStatus==="error"?"❌ 오류":"☁️ 저장"}
          </button>
          {isAdmin&&<>
            <button onClick={()=>{if(undoHistory.length>0){setFloors(undoHistory[undoHistory.length-1]);setUndoHistory(p=>p.slice(0,-1));}}} style={tbBtnS}>↩ 되돌리기</button>
            <button onClick={selectAll} style={tbBtnS}>☑ 전체선택</button>
            <button onClick={duplicateSelected} disabled={!selectedIds.length} style={{...tbBtnS,opacity:selectedIds.length?1:0.4}}>⿻ 복제</button>
            <button onClick={()=>setModal("saveVersion")} style={{...tbBtnS,backgroundColor:"#f8fafc",color:"#64748b"}}>💾 버전</button>
            <div style={{width:"1px",height:"20px",backgroundColor:"#e2e8f0"}}/>
            <button onClick={()=>setEmptyHighlight(p=>!p)} style={{...tbBtnS,backgroundColor:emptyHighlight?"#fef9c3":"#fff",color:emptyHighlight?"#b45309":"#475569"}}>{emptyHighlight?"⬜ ON":"⬜ 빈자리"}</button>
            <button onClick={()=>setZoneVisible(p=>!p)} style={{...tbBtnS,backgroundColor:zoneVisible?"#eff6ff":"#fff",color:zoneVisible?"#2563eb":"#475569"}}>{zoneVisible?"🗂 구역ON":"🗂 구역"}</button>
            <button onClick={handleExport} style={{...tbBtnS,backgroundColor:"#f0fdf4",color:"#059669"}}>🖼 PNG</button>
            {overlappingIds.size>0&&!allowOverlap&&<span style={{fontSize:"11px",color:"#ef4444",backgroundColor:"#fef2f2",padding:"4px 10px",borderRadius:"20px"}}>⚠ {overlappingIds.size}개 겹침</span>}
            <button onClick={()=>setAllowOverlap(p=>!p)} style={{...tbBtnS,backgroundColor:allowOverlap?"#fef9c3":"#fff",color:allowOverlap?"#b45309":"#94a3b8",fontSize:"10px"}}>{allowOverlap?"⚠ 겹침허용":"겹침허용"}</button>
            {zoneDrawMode&&<span style={{fontSize:"11px",color:"#b45309",backgroundColor:"#fef9c3",padding:"4px 10px",borderRadius:"20px"}}>✏️ 드래그로 구역 그리기</span>}
          </>}
          <div style={{display:"flex",alignItems:"center",gap:"3px",marginLeft:"auto"}}>
            <button onClick={()=>setZoom(z=>Math.max(0.2,z-0.1))} style={{...tbBtnS,padding:"6px 10px",fontWeight:700,fontSize:"14px"}}>−</button>
            <span style={{fontSize:"11px",color:"#64748b",minWidth:"40px",textAlign:"center",fontWeight:600}}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(2,z+0.1))} style={{...tbBtnS,padding:"6px 10px",fontWeight:700,fontSize:"14px"}}>＋</button>
            <button onClick={()=>{setZoom(0.7);setPan({x:0,y:0});}} style={{...tbBtnS,fontSize:"10px"}}>리셋</button>
          </div>
        </div>

        {/* 뷰포트 */}
        <div ref={viewportRef}
          style={{flex:1,borderRadius:"14px",border:"1px solid #e2e8f0",overflow:"hidden",position:"relative",userSelect:"none",backgroundColor:"#fafafa",backgroundImage:"radial-gradient(#e2e8f0 1px,transparent 1px)",backgroundSize:"20px 20px"}}
          onMouseDown={e=>{
            const target=e.target as HTMLElement;
            const isOnItem=target.closest("[data-item]");
            const isOnZone=target.closest("[data-zone]");
            if(!isOnItem&&!isOnZone&&!zoneDrawMode){isPanning.current=true;panStart.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};}
            handleCanvasMouseDown(e as unknown as React.MouseEvent<HTMLDivElement>);
          }}
          onMouseMove={e=>{
            if(isPanning.current&&!isBoxing.current)setPan({x:panStart.current.px+(e.clientX-panStart.current.x),y:panStart.current.py+(e.clientY-panStart.current.y)});
            handleCanvasMouseMove(e as unknown as React.MouseEvent<HTMLDivElement>);
          }}
          onMouseUp={e=>{isPanning.current=false;handleCanvasMouseUp();}}
          onMouseLeave={()=>{isPanning.current=false;handleCanvasMouseUp();}}>

          {/* 캔버스 */}
          <div ref={canvasRef}
            style={{position:"absolute",top:0,left:0,transformOrigin:"0 0",transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,width:"2400px",height:"1600px"}}>

            {/* 구역 */}
            {zoneVisible&&curZones.map(zone=>(
              <div key={zone.id} data-zone="true"
                onClick={e=>{e.stopPropagation();if(isAdmin){setSelectedZoneId(zone.id);setSelectedIds([]);}}}
                style={{position:"absolute",left:zone.x,top:zone.y,width:zone.width,height:zone.height,backgroundColor:hexToRgba(zone.color,0.12),border:`2px ${isAdmin&&selectedZoneId===zone.id?"solid":"dashed"} ${zone.color}`,borderRadius:"8px",zIndex:1,cursor:isAdmin?"pointer":"default",boxSizing:"border-box"}}>
                <span style={{position:"absolute",top:"6px",left:"10px",fontSize:"11px",fontWeight:700,color:zone.color,userSelect:"none",pointerEvents:"none"}}>{zone.name}</span>
                {isAdmin&&selectedZoneId===zone.id&&<>
                  <div style={{position:"absolute",right:0,bottom:0,width:"14px",height:"14px",backgroundColor:zone.color,borderRadius:"3px 0 8px 0",cursor:"se-resize",opacity:0.8}}
                    onMouseDown={e=>{e.stopPropagation();e.preventDefault();const sx=e.clientX,sy=e.clientY,sw=zone.width,sh=zone.height;
                      const onMove=(me:MouseEvent)=>updateZones(curZones.map(z=>z.id===zone.id?{...z,width:Math.max(60,sw+(me.clientX-sx)/zoom),height:Math.max(40,sh+(me.clientY-sy)/zoom)}:z));
                      const onUp=()=>{saveHistory();window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
                      window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);}}/>
                  <div style={{position:"absolute",inset:0,cursor:"move"}}
                    onMouseDown={e=>{e.stopPropagation();const sx=e.clientX,sy=e.clientY,zx=zone.x,zy=zone.y;
                      const onMove=(me:MouseEvent)=>updateZones(curZones.map(z=>z.id===zone.id?{...z,x:zx+(me.clientX-sx)/zoom,y:zy+(me.clientY-sy)/zoom}:z));
                      const onUp=()=>{saveHistory();window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
                      window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);}}/>
                </>}
              </div>
            ))}

            {/* 스냅 가이드 */}
            {snapGuides.x!==undefined&&<div style={{position:"absolute",left:snapGuides.x,top:0,bottom:0,width:"1px",backgroundColor:"#2563eb",opacity:0.5,zIndex:200,pointerEvents:"none"}}/>}
            {snapGuides.y!==undefined&&<div style={{position:"absolute",top:snapGuides.y,left:0,right:0,height:"1px",backgroundColor:"#2563eb",opacity:0.5,zIndex:200,pointerEvents:"none"}}/>}

            {/* 좌석/벽/문/공간 */}
            {curItems.map(item=>{
              const isSel=selectedIds.includes(item.id);
              const isOv=overlappingIds.has(item.id);
              const isHl=searchHighlightId===item.id;
              const isEmpty=item.type==="seat"&&(!item.name||item.name==="새 좌석"||item.name.trim()==="");
              const isEmptyHl=emptyHighlight&&isEmpty;
              const bgColor=isOv?"#fee2e2":isHl?"#fbbf24":isEmptyHl?"#fef9c3":applyOpacity(item.color,colorToOpacity(item.color));
              const borderColor=isHl?"#f59e0b":isSel?"#2563eb":isOv?"#ef4444":isEmptyHl?"#f59e0b":"rgba(0,0,0,0.08)";
              return(
                <Draggable key={item.id} position={{x:item.x,y:item.y}} scale={zoom}
                  onStart={(e)=>{
                    if(!isAdmin)return false;
                    const me=e as unknown as MouseEvent;
                    if(me.shiftKey){setSelectedIds(p=>p.includes(item.id)?p.filter(id=>id!==item.id):[...p,item.id]);return false;}
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
                    setSnapGuides({x:sn.snappedX?sn.x:undefined,y:sn.snappedY?sn.y:undefined});
                    updateItems(moved.map(i=>ids.includes(i.id)?{...i,x:i.x+(sn.x-rep.x),y:i.y+(sn.y-rep.y)}:i));
                  }}
                  onStop={()=>{saveHistory();setSnapGuides({});}}
                  disabled={!isAdmin}>
                  <div data-item="true" style={{position:"absolute",zIndex:item.type==="space"?2:isSel?100:10,cursor:isAdmin?"grab":"default"}}
                    onClick={e=>{if(!isAdmin)return;e.stopPropagation();if(e.shiftKey)setSelectedIds(p=>p.includes(item.id)?p.filter(id=>id!==item.id):[...p,item.id]);else{setSelectedIds([item.id]);setSelectedZoneId(null);}}}>
                    {item.type==="door"
                      ?<DoorShape w={item.width} h={item.height} color={item.color} rotation={item.rotation} name={item.name} isSelected={isSel}/>
                      :item.type==="space"
                      ?<div style={{width:item.width,height:item.height,backgroundColor:hexToRgba(item.color,0.25),border:`${isSel?"2":"1"}px ${isSel?"solid":"dashed"} ${isSel?"#2563eb":item.color}`,borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",color:item.color,fontSize:"12px",fontWeight:700,userSelect:"none"}}>{item.name}</div>
                      :<div style={{transform:`rotate(${item.rotation}deg)`,width:item.width,height:item.height,backgroundColor:bgColor,border:`${isSel||isOv||isEmptyHl?"2":"1"}px solid ${borderColor}`,borderRadius:item.type==="wall"?"3px":"7px",display:"flex",alignItems:"center",justifyContent:"center",color:isOv?"#ef4444":isHl?"#92400e":isEmptyHl?"#b45309":item.textColor,fontSize:"11px",fontWeight:700,textAlign:"center",boxShadow:isHl?"0 0 0 4px #f59e0b,0 0 20px rgba(245,158,11,0.6)":isSel?"0 0 0 3px rgba(37,99,235,0.2)":isOv?"0 0 0 3px rgba(239,68,68,0.2)":"0 1px 3px rgba(0,0,0,0.06)",userSelect:"none"}}>
                          {isEmptyHl&&!item.name?"빈자리":item.name}
                        </div>
                    }
                  </div>
                </Draggable>
              );
            })}

            {/* 박스 셀렉션 (진행중) */}
            {isBoxing.current&&boxSel&&<div style={{position:"absolute",pointerEvents:"none",
              left:Math.min(boxSel.sx,boxSel.ex),top:Math.min(boxSel.sy,boxSel.ey),
              width:Math.abs(boxSel.ex-boxSel.sx),height:Math.abs(boxSel.ey-boxSel.sy),
              border:"1.5px dashed #2563eb",backgroundColor:"rgba(37,99,235,0.05)",zIndex:500,borderRadius:"3px"}}/>}
          </div>

          {/* 박스 셀렉션 (뷰포트 좌표) */}
          {boxSel&&<div style={{position:"absolute",pointerEvents:"none",
            left:Math.min(boxSel.sx,boxSel.ex)*zoom+pan.x,top:Math.min(boxSel.sy,boxSel.ey)*zoom+pan.y,
            width:Math.abs(boxSel.ex-boxSel.sx)*zoom,height:Math.abs(boxSel.ey-boxSel.sy)*zoom,
            border:"1.5px dashed #2563eb",backgroundColor:"rgba(37,99,235,0.07)",zIndex:9999,borderRadius:"3px"}}/>}
        </div>
      </div>

      {/* ── 우측 속성 패널 ── */}
      {isAdmin&&(
        <div style={{width:"230px",backgroundColor:"#fff",padding:"14px",borderLeft:"1px solid #e2e8f0",overflowY:"auto",boxShadow:"-2px 0 8px rgba(0,0,0,0.04)"}}>
          {selZone&&selectedIds.length===0?(
            <div>
              <div style={pcS}>
                <div style={slS}>🗂 구역 설정</div>
                <input value={selZone.name} onChange={e=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,name:e.target.value}:z))} style={inS} placeholder="구역 이름"/>
                <div style={{display:"flex",gap:"4px",marginTop:"8px"}}>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>너비</div><input type="number" value={Math.round(selZone.width)} onChange={e=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,width:Math.max(60,+e.target.value)}:z))} style={inS}/></div>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>높이</div><input type="number" value={Math.round(selZone.height)} onChange={e=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,height:Math.max(40,+e.target.value)}:z))} style={inS}/></div>
                </div>
                <div style={{marginTop:"8px"}}>
                  <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"4px"}}>색상</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#64748b","#ec4899"].map(c=>(
                      <div key={c} onClick={()=>updateZones(curZones.map(z=>z.id===selZone.id?{...z,color:c}:z))} style={{width:"20px",height:"20px",borderRadius:"50%",backgroundColor:c,cursor:"pointer",border:selZone.color===c?"3px solid #1e293b":"2px solid transparent"}}/>
                    ))}
                  </div>
                </div>
                <button onClick={()=>{saveHistory();updateZones(curZones.filter(z=>z.id!==selZone.id));setSelectedZoneId(null);}} style={{width:"100%",marginTop:"10px",padding:"7px",border:"1px solid #fecaca",borderRadius:"6px",fontSize:"11px",cursor:"pointer",backgroundColor:"#fef2f2",color:"#ef4444",fontWeight:700}}>🗑 구역 삭제</button>
              </div>
            </div>
          ):selItems.length>0?(
            <div>
              <div style={pcS}>
                <div style={slS}>{selItems.length>1?`${selItems.length}개 선택`:"좌석 설정"}</div>
                {selItems.length===1&&<>
                  <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"3px"}}>이름</div>
                  <input value={selItems[0].name} onChange={e=>updateItems(curItems.map(i=>i.id===selItems[0].id?{...i,name:e.target.value}:i))} style={{...inS,marginBottom:"8px"}} placeholder="이름"/>
                </>}
                <div style={{display:"flex",gap:"4px",marginBottom:"8px"}}>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>너비</div><input type="number" value={selItems[0].width} onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,width:Math.max(10,+e.target.value)}:i))} style={inS}/></div>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>높이</div><input type="number" value={selItems[0].height} onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,height:Math.max(10,+e.target.value)}:i))} style={inS}/></div>
                </div>
                <div style={{display:"flex",gap:"4px",marginBottom:"8px"}}>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>X</div><input type="number" value={Math.round(selItems[0].x)} onChange={e=>updateItems(curItems.map(i=>i.id===selItems[0].id?{...i,x:+e.target.value}:i))} style={inS}/></div>
                  <div style={{flex:1}}><div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"2px"}}>Y</div><input type="number" value={Math.round(selItems[0].y)} onChange={e=>updateItems(curItems.map(i=>i.id===selItems[0].id?{...i,y:+e.target.value}:i))} style={inS}/></div>
                </div>
                {selItems[0].type==="seat"&&<>
                  <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"4px"}}>회전</div>
                  <div style={{display:"flex",gap:"4px",marginBottom:"8px"}}>
                    {[0,90,180,270].map(r=>(
                      <button key={r} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,rotation:r}:i))} style={{flex:1,padding:"4px",border:`1px solid ${selItems[0].rotation===r?"#2563eb":"#e2e8f0"}`,borderRadius:"5px",fontSize:"10px",cursor:"pointer",backgroundColor:selItems[0].rotation===r?"#eff6ff":"#fff",color:selItems[0].rotation===r?"#2563eb":"#64748b",fontWeight:600}}>{r}°</button>
                    ))}
                  </div>
                </>}
                <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"4px"}}>색상</div>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"8px"}}>
                  {[...["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#64748b","#ec4899","#475569"],...customPalette].map(c=>(
                    <div key={c} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:c}:i))} style={{width:"22px",height:"22px",borderRadius:"50%",backgroundColor:c,cursor:"pointer",border:colorToHex(selItems[0].color)===c?"3px solid #1e293b":"2px solid transparent"}}/>
                  ))}
                  <div onClick={()=>pickRef.current?.click()} style={{width:"22px",height:"22px",borderRadius:"50%",backgroundColor:"#fff",cursor:"pointer",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",color:"#94a3b8"}}>+</div>
                  <input ref={pickRef} type="color" style={{display:"none"}} onChange={e=>{const c=e.target.value;setCustomPalette(p=>[...p.filter(x=>x!==c),c]);updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:c}:i));}}/>
                </div>
                <div style={{marginBottom:"8px"}}>
                  <div style={{fontSize:"9px",color:"#94a3b8",marginBottom:"4px"}}>글자색</div>
                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                    {["#ffffff","#1e293b","#ef4444","#f59e0b","#10b981","#2563eb","#8b5cf6"].map(c=>(
                      <div key={c} onClick={()=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,textColor:c}:i))}
                        style={{width:"22px",height:"22px",borderRadius:"50%",backgroundColor:c,cursor:"pointer",border:selItems[0].textColor===c?"3px solid #2563eb":"2px solid #e2e8f0",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:"8px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <span style={{fontSize:"9px",color:"#94a3b8"}}>투명도</span>
                    <span style={{fontSize:"9px",color:"#64748b",fontWeight:700}}>{Math.round(colorToOpacity(selItems[0].color)*100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="1" step="0.05" value={colorToOpacity(selItems[0].color)}
                    onChange={e=>updateItems(curItems.map(i=>selectedIds.includes(i.id)?{...i,color:applyOpacity(colorToHex(i.color),+e.target.value)}:i))}
                    style={{width:"100%",accentColor:"#2563eb"}}/>
                </div>
                <div style={{display:"flex",gap:"4px"}}>
                  <button onClick={duplicateSelected} style={{flex:1,padding:"7px",border:"1px solid #d1fae5",borderRadius:"6px",fontSize:"11px",cursor:"pointer",backgroundColor:"#ecfdf5",color:"#10b981",fontWeight:700}}>⿻ 복제</button>
                  <button onClick={()=>{saveHistory();updateItems(curItems.filter(i=>!selectedIds.includes(i.id)));setSelectedIds([]);}} style={{flex:1,padding:"7px",border:"1px solid #fecaca",borderRadius:"6px",fontSize:"11px",cursor:"pointer",backgroundColor:"#fef2f2",color:"#ef4444",fontWeight:700}}>🗑 삭제</button>
                </div>
              </div>
            </div>
          ):(
            <div style={{textAlign:"center",padding:"20px 0",color:"#94a3b8"}}>
              <div style={{fontSize:"24px",marginBottom:"8px"}}>👆</div>
              <div style={{fontSize:"11px"}}>좌석을 클릭하거나<br/>드래그로 다중 선택</div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
