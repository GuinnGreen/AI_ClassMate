export const isCurrentPeriod = (periodName: string): boolean => {
  const match = periodName.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (!match) return false;

  const [, startStr, endStr] = match;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (str: string) => {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  };

  const startMinutes = parseTime(startStr);
  const endMinutes = parseTime(endStr);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

export const getPeriodParts = (fullString: string) => {
  const parts = fullString.trim().split(' ');
  if (parts.length >= 2) {
    const name = parts[0];
    const time = parts.slice(1).join(' ');
    return { name, time };
  }
  return { name: fullString, time: '' };
};
