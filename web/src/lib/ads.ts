import { AdData, AdSlot, SpinResult } from '@/types/ad';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ADS_DIR = path.join(process.cwd(), 'data', 'ads');
const SLOTS_FILE = path.join(ADS_DIR, 'slots.json');
const ATTEMPTS_FILE = path.join(ADS_DIR, 'attempts.json');

// 당첨 확률 0.1% (1/1000)
const WIN_PROBABILITY = 0.001;

// IP 해시 생성 (개인정보 보호)
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + 'dailyapp-salt').digest('hex').substring(0, 16);
}

// 오늘 날짜 (YYYY-MM-DD)
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// 광고 슬롯 데이터 읽기
export function getAdSlots(): AdData {
  try {
    const data = fs.readFileSync(SLOTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      slots: {
        left1: { id: 'left1', imageUrl: null, uploadedAt: null, ipHash: null },
        left2: { id: 'left2', imageUrl: null, uploadedAt: null, ipHash: null },
        right1: { id: 'right1', imageUrl: null, uploadedAt: null, ipHash: null },
        right2: { id: 'right2', imageUrl: null, uploadedAt: null, ipHash: null }
      },
      lastUpdated: new Date().toISOString()
    };
  }
}

// 광고 슬롯 데이터 저장
export function saveAdSlots(data: AdData): void {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(SLOTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// IP 시도 기록 읽기
function getAttempts(): Record<string, string[]> {
  try {
    const data = fs.readFileSync(ATTEMPTS_FILE, 'utf-8');
    return JSON.parse(data).attempts || {};
  } catch {
    return {};
  }
}

// IP 시도 기록 저장
function saveAttempts(attempts: Record<string, string[]>): void {
  fs.writeFileSync(ATTEMPTS_FILE, JSON.stringify({ attempts }, null, 2), 'utf-8');
}

// 오늘 이 IP가 특정 슬롯에 시도했는지 확인
export function hasAttemptedToday(ipHash: string, slotId: string): boolean {
  const attempts = getAttempts();
  const key = `${ipHash}:${getToday()}`;
  return attempts[key]?.includes(slotId) || false;
}

// 오늘 이 IP가 시도 가능한 슬롯 목록
export function getAvailableSlots(ipHash: string): string[] {
  const attempts = getAttempts();
  const key = `${ipHash}:${getToday()}`;
  const attemptedSlots = attempts[key] || [];
  const allSlots = ['left1', 'left2', 'right1', 'right2'];
  return allSlots.filter(slot => !attemptedSlots.includes(slot));
}

// 시도 기록 추가
export function recordAttempt(ipHash: string, slotId: string): void {
  const attempts = getAttempts();
  const key = `${ipHash}:${getToday()}`;

  if (!attempts[key]) {
    attempts[key] = [];
  }

  if (!attempts[key].includes(slotId)) {
    attempts[key].push(slotId);
  }

  // 오래된 기록 정리 (7일 이전)
  const today = new Date();
  const cleanedAttempts: Record<string, string[]> = {};

  for (const [k, v] of Object.entries(attempts)) {
    const dateStr = k.split(':')[1];
    const date = new Date(dateStr);
    const diffDays = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays <= 7) {
      cleanedAttempts[k] = v;
    }
  }

  saveAttempts(cleanedAttempts);
}

// 룰렛 돌리기
export function spin(ipHash: string, slotId: string): SpinResult {
  // 유효한 슬롯인지 확인
  const validSlots = ['left1', 'left2', 'right1', 'right2'];
  if (!validSlots.includes(slotId)) {
    return {
      success: false,
      won: false,
      message: '잘못된 슬롯입니다.',
      canRetry: false
    };
  }

  // 오늘 이미 시도했는지 확인
  if (hasAttemptedToday(ipHash, slotId)) {
    const available = getAvailableSlots(ipHash);
    return {
      success: false,
      won: false,
      message: '이 슬롯은 오늘 이미 도전했습니다!',
      canRetry: available.length > 0,
      remainingSlots: available
    };
  }

  // 시도 기록
  recordAttempt(ipHash, slotId);

  // 0.1% 확률로 당첨
  const won = Math.random() < WIN_PROBABILITY;
  const available = getAvailableSlots(ipHash);

  if (won) {
    return {
      success: true,
      won: true,
      message: '🎉 축하합니다! 당첨되었습니다!',
      canRetry: false
    };
  } else {
    return {
      success: true,
      won: false,
      message: '아쉽네요! 다음 기회에 도전하세요.',
      canRetry: available.length > 0,
      remainingSlots: available
    };
  }
}

// 광고 이미지 업데이트
export function updateAdSlot(slotId: string, imageUrl: string, ipHash: string): boolean {
  try {
    const data = getAdSlots();
    const slot = data.slots[slotId as keyof typeof data.slots];

    if (!slot) return false;

    slot.imageUrl = imageUrl;
    slot.uploadedAt = new Date().toISOString();
    slot.ipHash = ipHash;

    saveAdSlots(data);
    return true;
  } catch {
    return false;
  }
}
