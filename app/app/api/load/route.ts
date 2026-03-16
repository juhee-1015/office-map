import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'seatmap.json' });
    if (blobs.length === 0) return NextResponse.json(null);
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json(null);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('load error:', e);
    return NextResponse.json(null);
  }
}
