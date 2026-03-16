import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function GET() {
  const { blobs } = await list({ prefix: 'seatmap.json' });
  if (blobs.length === 0) return NextResponse.json(null);
  const res = await fetch(blobs[0].url);
  const data = await res.json();
  return NextResponse.json(data);
}
