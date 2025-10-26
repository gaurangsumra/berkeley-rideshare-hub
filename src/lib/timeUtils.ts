export const getTimeWindow = (departureTime: Date): string => {
  const hour = departureTime.getHours();
  const nextHour = (hour + 1) % 24;
  
  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:00 ${period}`;
  };
  
  return `${formatHour(hour)} - ${formatHour(nextHour)}`;
};

export const sortTimeWindows = (windows: string[]): string[] => {
  return windows.sort((a, b) => {
    const getHourValue = (window: string) => {
      const match = window.match(/^(\d+):00 (AM|PM)/);
      if (!match) return 0;
      let hour = parseInt(match[1]);
      const period = match[2];
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return hour;
    };
    return getHourValue(a) - getHourValue(b);
  });
};
