import { useCallback, useEffect, useRef, useState } from 'react';
import type { HubConnection } from '@microsoft/signalr';

const SAMPLES = 7;
const DELAY_MS = 100;

export function useClockSync(connection: HubConnection | null) {
  const offsetRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);

  useEffect(() => {
    if (!connection || connection.state !== 'Connected') return;
    let cancelled = false;

    (async () => {
      const samples: { rtt: number; offset: number }[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        if (cancelled) return;
        try {
          const t1 = Date.now();
          const serverNow = await connection.invoke<number>('Ping');
          const t4 = Date.now();
          const rttMs = t4 - t1;
          const offset = serverNow - (t1 + t4) / 2;
          samples.push({ rtt: rttMs, offset });
        } catch {
          return;
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
      if (cancelled || samples.length === 0) return;
      samples.sort((a, b) => a.rtt - b.rtt);
      offsetRef.current = samples[0].offset;
      setRtt(samples[0].rtt);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [connection]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  return { serverNow, ready, rtt };
}
