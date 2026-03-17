import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../modules/auth/auth-store';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

// The WebSocket handshake carries the access token — it must travel over WSS.
// Refuse to start in a production build without an explicit secure URL.
if (import.meta.env.PROD && !import.meta.env.VITE_SOCKET_URL) {
  throw new Error('[TMA] VITE_SOCKET_URL is not set. Production builds require an explicit WSS socket URL.');
}

interface SocketNotification {
  message?: string;
}

function isSocketNotification(v: unknown): v is SocketNotification {
  return typeof v === 'object' && v !== null;
}

export function useSocket(onNotification?: (notification: SocketNotification) => void): void {
  const { accessToken } = useAuthStore();
  // Keep the latest callback in a ref so the effect closure never goes stale.
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!accessToken) return;

    // Start with polling so the connection is guaranteed before upgrading to
    // WebSocket. Listing WebSocket first causes a harmless-but-noisy
    // "WebSocket closed before connection established" error in the console
    // on every page load because the upgrade races the initial handshake.
    const socket: Socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      console.info('[Socket] Connected');
    });

    socket.on('notification:new', (raw: unknown) => {
      if (!isSocketNotification(raw)) return;
      const message = typeof raw.message === 'string' ? raw.message : 'New notification';
      toast(message, { icon: '🔔', duration: 5000 });
      callbackRef.current?.(raw);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socket.on('disconnect', () => {
      console.info('[Socket] Disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);
}
