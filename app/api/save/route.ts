import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const blob = await put('seatmap.json', JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error('save error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
