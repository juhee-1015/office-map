import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const data = await request.json();
  const blob = await put('seatmap.json', JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url });
}
