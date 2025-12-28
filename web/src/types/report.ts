export interface AppScore {
  아이디어: number;
  실현가능성: number;
  시장성: number;
  종합: number;
}

export interface AppInfo {
  순위: number;
  앱이름: string;
  개발자: string;
  카테고리: string;
  아이콘: string;
  앱링크: string;
  핵심아이디어: string;
  점수: AppScore;
  태그: string[];
  예상개발기간: string;
  예상비용: string;
  난이도: number;
}

export interface DailyReport {
  날짜: string;
  iOS: AppInfo[];
  Android: AppInfo[];
  트렌드인사이트: string;
}
