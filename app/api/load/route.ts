import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'seatmap.json' });
    if (blobs.length === 0) return NextResponse.json(null);

    // 가장 최근 수정된 파일 선택
    const latest = blobs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];

    const res = await fetch(latest.url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!res.ok) return NextResponse.json(null);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('load error:', e);
    return NextResponse.json(null);
  }
}
