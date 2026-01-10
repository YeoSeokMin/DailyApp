import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// 심층 분석 리포트 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 보안: ID 검증 (경로 조작 방지)
    if (!id || /[\/\\]/.test(id)) {
      return NextResponse.json(
        { error: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // 리포트 경로
    const reportsDir = path.join(process.cwd(), '..', 'reports', 'deep');
    const filePath = path.join(reportsDir, `${id}.md`);

    // 파일 읽기
    const content = await fs.readFile(filePath, 'utf-8');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Deep report fetch error:', error);
    return NextResponse.json(
      { error: 'Report not found' },
      { status: 404 }
    );
  }
}
