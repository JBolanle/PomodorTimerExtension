import { useState, useEffect, useRef } from 'react';
import { sendMessage } from '@/lib/messaging';

export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState(true);
  const failCountRef = useRef(0);

  useEffect(() => {
    const checkConnection = () => {
      sendMessage('ping')
        .then(() => {
          failCountRef.current = 0;
          setConnected(true);
        })
        .catch(() => {
          failCountRef.current++;
          if (failCountRef.current >= 2) {
            setConnected(false);
          }
        });
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  return connected;
}
