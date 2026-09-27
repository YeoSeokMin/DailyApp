'use client';

import { useEffect, useRef } from 'react';

interface DateSelectorProps {
  dates: string[];
  currentDate: string;
}

export default function DateSelector({ dates, currentDate }: DateSelectorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  // 뒤로가기(bfcache) 복원 시 select 에 '이동했던 날짜'가 남아 URL 과 어긋난다.
  // 그 상태에서 같은 날짜를 다시 고르면 onChange 가 안 떠서 이동이 불가능했다.
  useEffect(() => {
    // 폼 상태 복원(비-bfcache)도 같은 증상이라 persisted 여부와 무관하게 되돌린다.
    const onPageShow = () => {
      if (selectRef.current) selectRef.current.value = currentDate;
    };
    onPageShow();
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [currentDate]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDate = e.target.value;
    if (selectedDate === dates[0]) {
      window.location.href = '/';
    } else {
      window.location.href = `/report/${selectedDate}`;
    }
  };

  return (
    <select
      ref={selectRef}
      className="text-sm cursor-pointer px-3 py-2 pixel-input"
      defaultValue={currentDate}
      onChange={handleChange}
    >
      {dates.map(d => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}
