import React, { useState, useEffect } from 'react';
import { ClockIcon } from './icons';

export const Clock: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formatTimeParts = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    const shortDatePart = `${year}/${month}/${day}`;
    const longDatePart = `${shortDatePart} (週${dayOfWeek})`;
    const timePart = `${hours}:${minutes}:${seconds}`;

    return { shortDatePart, longDatePart, timePart };
  };

  const { shortDatePart, longDatePart, timePart } = formatTimeParts(currentTime);
  const fullDateTimeString = `${longDatePart} ${timePart}`;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
      <ClockIcon className="w-5 h-5 text-cyan-400 shrink-0" />
      <div className="flex items-baseline whitespace-nowrap" aria-label={fullDateTimeString} aria-live="polite">
        <span className="hidden md:inline-block mr-2">{longDatePart}</span>
        <span className="hidden sm:inline-block md:hidden mr-2">{shortDatePart}</span>
        <span className="font-mono">{timePart}</span>
      </div>
    </div>
  );
};
