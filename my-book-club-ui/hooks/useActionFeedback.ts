import { useEffect, useRef, useState } from "react";

export function useActionFeedback(durationMs = 1800) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const flashLabel = (key: string, label: string) => {
    const existingTimer = timersRef.current[key];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    setLabels((current) => ({ ...current, [key]: label }));
    timersRef.current[key] = setTimeout(() => {
      setLabels((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete timersRef.current[key];
    }, durationMs);
  };

  const runWithFeedback = async (key: string, label: string, action: () => Promise<void>) => {
    await action();
    flashLabel(key, label);
  };

  return {
    labels,
    flashLabel,
    runWithFeedback,
  };
}
