import { useEffect, useState } from 'react';

/** Seconds since mount. Task components use it to time-gate their skip button. */
export function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}
