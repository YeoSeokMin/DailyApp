// 광고 슬롯 타입
export interface AdSlot {
  id: 'left1' | 'left2' | 'right1' | 'right2';
  imageUrl: string | null;  // null이면 빈 슬롯
  linkUrl: string | null;   // 클릭 시 이동할 링크
  uploadedAt: string | null;
  ipHash: string | null;    // 업로더 IP 해시 (개인정보 보호)
}

// 광고 데이터 전체
export interface AdData {
  slots: {
    left1: AdSlot;
    left2: AdSlot;
    right1: AdSlot;
    right2: AdSlot;
  };
  lastUpdated: string;
}

// IP 시도 기록
export interface IpAttempt {
  date: string;      // YYYY-MM-DD
  slots: string[];   // 시도한 슬롯 ID 목록
}

// 스핀 결과
export interface SpinResult {
  success: boolean;
  won: boolean;
  message: string;
  canRetry: boolean;
  remainingSlots?: string[];
}

// 업로드 결과
export interface UploadResult {
  success: boolean;
  message: string;
  slotId?: string;
}
