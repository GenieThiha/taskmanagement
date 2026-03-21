import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuthStore } from '../modules/auth/auth-store';
import { refresh as refreshTokens } from '../api/auth-api';
import { getNotifications } from '../api/notification-api';

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
  // Set to true after a server-forced disconnect so the next connect handler
  // syncs any notifications missed during the gap.
  const needsSyncRef = useRef(false);

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

    socket.on('connect', async () => {
      console.info('[Socket] Connected');
      if (needsSyncRef.current) {
        needsSyncRef.current = false;
        // Replay notifications missed during the disconnect window so the
        // caller's unread count stays accurate.
        try {
          const res = await getNotifications({ limit: 20 });
          const missed: unknown[] = res.data ?? [];
          missed.forEach((n) => {
            if (isSocketNotification(n)) callbackRef.current?.(n);
          });
        } catch {
          // Best-effort sync — ignore errors
        }
      }
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

    socket.on('disconnect', async (reason) => {
      console.info('[Socket] Disconnected');
      if (reason === 'io server disconnect') {
        // Server forced disconnect — access token expired (server registers a
        // setTimeout to disconnect on expiry per security spec).
        // Silently refresh; updating the store causes this effect to re-run,
        // which tears down this socket and opens a new one with the fresh token.
        try {
          const tokens = await refreshTokens();
          needsSyncRef.current = true;
          useAuthStore.getState().setAccessToken(tokens.accessToken);
        } catch {
          // Refresh failed — Axios interceptor has already called clearAuth()
          // and redirected to /login.
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);
}
