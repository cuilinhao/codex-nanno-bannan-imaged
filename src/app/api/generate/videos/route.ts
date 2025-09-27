import { NextResponse } from 'next/server';
import { generateVideos } from '@/lib/video-generation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { numbers?: string[] };
    const result = await generateVideos({ numbers: body.numbers });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('图生视频任务失败', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || '生成视频失败' },
      { status: 500 },
    );
  }
}
