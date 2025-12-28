export interface AppInfo {
  순위: number;
  앱이름: string;
  개발자: string;
  카테고리: string;
  아이콘: string;
  앱링크: string;
  핵심아이디어: string;
  해결하는문제: string;
  왜좋은아이디어인가: string;
  개발자참고포인트: string;
  수익화가능성: string;
}

export interface DailyReport {
  날짜: string;
  iOS: AppInfo[];
  Android: AppInfo[];
  트렌드인사이트: string;
}
