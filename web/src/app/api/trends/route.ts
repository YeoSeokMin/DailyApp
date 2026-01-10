import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const trendsPath = path.join(process.cwd(), '..', 'output', 'trends.json');

    if (!fs.existsSync(trendsPath)) {
      return NextResponse.json({
        success: false,
        error: '트렌드 데이터가 없습니다',
      });
    }

    const content = fs.readFileSync(trendsPath, 'utf8');
    const trends = JSON.parse(content);

    return NextResponse.json({
      success: true,
      trends,
    });
  } catch (error) {
    console.error('트렌드 로드 실패:', error);
    return NextResponse.json({
      success: false,
      error: '트렌드 로드 실패',
    });
  }
}
