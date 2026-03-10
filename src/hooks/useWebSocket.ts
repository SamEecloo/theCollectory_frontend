import { useEffect, useRef, useCallback } from "react";

const WS_BASE = `${import.meta.env.VITE_WS_URL || "ws://localhost:5000"}/ws`;
const RECONNECT_DELAY = 3000;

type WSEvent = {
  event: "connected" | "new_message" | "notification" | "pong";
  payload?: any;
};

type WSEventHandler = (data: WSEvent) => void;

export function useWebSocket(token: string | null, onEvent: WSEventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const intentionalClose = useRef(false);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!token) return;

    // Don't open a new connection if one is already open or connecting
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    intentionalClose.current = false;
    const ws = new WebSocket(`${WS_BASE}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: "ping" }));
        }
      }, 30_000);
      (ws as any)._ping = ping;
    };

    ws.onmessage = (e) => {
      try {
        const data: WSEvent = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {}
    };

    ws.onclose = () => {
      clearInterval((ws as any)._ping);
      // Only reconnect if this wasn't an intentional cleanup close
      if (!intentionalClose.current) {
        console.log("[WS] Disconnected — reconnecting in", RECONNECT_DELAY, "ms");
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => ws.close();
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}