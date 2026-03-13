import { useState, useEffect, useRef } from 'react';

export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState(true);
  const failCountRef = useRef(0);

  useEffect(() => {
    const checkConnection = () => {
      chrome.runtime.sendMessage({ action: 'ping' }, () => {
        if (chrome.runtime.lastError) {
          failCountRef.current++;
          if (failCountRef.current >= 2) {
            setConnected(false);
          }
        } else {
          failCountRef.current = 0;
          setConnected(true);
        }
      });
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  return connected;
}
