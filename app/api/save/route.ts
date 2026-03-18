import { put, list, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 기존 파일 삭제 후 새로 저장
    const { blobs } = await list({ prefix: 'seatmap-data.json' });
    if (blobs.length > 0) {
      await del(blobs.map(b => b.url));
    }

    const blob = await put('seatmap-data.json', JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error('save error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
