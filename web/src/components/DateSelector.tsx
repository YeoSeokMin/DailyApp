'use client';

interface DateSelectorProps {
  dates: string[];
  currentDate: string;
}

export default function DateSelector({ dates, currentDate }: DateSelectorProps) {
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
      className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm cursor-pointer"
      defaultValue={currentDate}
      onChange={handleChange}
    >
      {dates.map(d => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}
