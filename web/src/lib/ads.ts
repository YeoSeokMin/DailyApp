import { AdData, AdSlot, SpinResult } from '@/types/ad';
import crypto from 'crypto';
import { kv } from '@vercel/kv';

// 당첨 확률 0.1% (1/1000)
const WIN_PROBABILITY = 0.001;

// KV 키
const SLOTS_KEY = 'ad:slots';
const ATTEMPTS_PREFIX = 'ad:attempts:';

// 기본 슬롯 데이터
const DEFAULT_SLOTS: AdData = {
  slots: {
    left1: { id: 'left1', imageUrl: null, linkUrl: null, uploadedAt: null, ipHash: null },
    left2: { id: 'left2', imageUrl: null, linkUrl: null, uploadedAt: null, ipHash: null },
    right1: { id: 'right1', imageUrl: null, linkUrl: null, uploadedAt: null, ipHash: null },
    right2: { id: 'right2', imageUrl: null, linkUrl: null, uploadedAt: null, ipHash: null }
  },
  lastUpdated: new Date().toISOString()
};

// IP 해시 생성 (개인정보 보호)
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + 'dailyapp-salt').digest('hex').substring(0, 16);
}

// 오늘 날짜 (YYYY-MM-DD)
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// 광고 슬롯 데이터 읽기
export async function getAdSlots(): Promise<AdData> {
  try {
    const data = await kv.get<AdData>(SLOTS_KEY);
    return data || DEFAULT_SLOTS;
  } catch {
    return DEFAULT_SLOTS;
  }
}

// 광고 슬롯 데이터 저장
export async function saveAdSlots(data: AdData): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  await kv.set(SLOTS_KEY, data);
}

// 오늘 이 IP가 특정 슬롯에 시도했는지 확인
export async function hasAttemptedToday(ipHash: string, slotId: string): Promise<boolean> {
  const key = `${ATTEMPTS_PREFIX}${ipHash}:${getToday()}`;
  const attempts = await kv.smembers(key);
  return attempts?.includes(slotId) || false;
}

// 오늘 이 IP가 시도 가능한 슬롯 목록
export async function getAvailableSlots(ipHash: string): Promise<string[]> {
  const key = `${ATTEMPTS_PREFIX}${ipHash}:${getToday()}`;
  const attemptedSlots = await kv.smembers(key) || [];
  const allSlots = ['left1', 'left2', 'right1', 'right2'];
  return allSlots.filter(slot => !attemptedSlots.includes(slot));
}

// 시도 기록 추가
export async function recordAttempt(ipHash: string, slotId: string): Promise<void> {
  const key = `${ATTEMPTS_PREFIX}${ipHash}:${getToday()}`;
  await kv.sadd(key, slotId);
  // 24시간 후 자동 만료
  await kv.expire(key, 86400);
}

// 룰렛 돌리기
export async function spin(ipHash: string, slotId: string): Promise<SpinResult> {
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
  if (await hasAttemptedToday(ipHash, slotId)) {
    const available = await getAvailableSlots(ipHash);
    return {
      success: false,
      won: false,
      message: '이 슬롯은 오늘 이미 도전했습니다!',
      canRetry: available.length > 0,
      remainingSlots: available
    };
  }

  // 시도 기록
  await recordAttempt(ipHash, slotId);

  // 0.1% 확률로 당첨
  const won = Math.random() < WIN_PROBABILITY;
  const available = await getAvailableSlots(ipHash);

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
export async function updateAdSlot(slotId: string, imageUrl: string, linkUrl: string | null, ipHash: string): Promise<boolean> {
  try {
    const data = await getAdSlots();
    const slot = data.slots[slotId as keyof typeof data.slots];

    if (!slot) return false;

    slot.imageUrl = imageUrl;
    slot.linkUrl = linkUrl;
    slot.uploadedAt = new Date().toISOString();
    slot.ipHash = ipHash;

    await saveAdSlots(data);
    return true;
  } catch {
    return false;
  }
}
