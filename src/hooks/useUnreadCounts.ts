import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import api from "@/lib/api";

interface UnreadCounts {
  notifications: number;
  messages: number;
}

interface UseUnreadCountsReturn {
  counts: UnreadCounts;
  refreshCounts: () => void;
}

export function useUnreadCounts(token: string | null): UseUnreadCountsReturn {
  const [counts, setCounts] = useState<UnreadCounts>({ notifications: 0, messages: 0 });

  const refreshCounts = useCallback(() => {
    if (!token) {
      setCounts({ notifications: 0, messages: 0 });
      return;
    }
    api.get("/notifications/counts")
      .then((r) => setCounts(r.data))
      .catch(() => {});
  }, [token]);

  // Fetch on mount and when token changes
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Live increments via WebSocket
  const handleWsEvent = useCallback((data: { event: string; payload?: any }) => {
    if (data.event === "notification") {
      const type = data.payload?.type;
      if (type === "message") {
        setCounts((prev) => ({ ...prev, messages: prev.messages + 1 }));
      } else {
        setCounts((prev) => ({ ...prev, notifications: prev.notifications + 1 }));
      }
    }
  }, []);

  useWebSocket(token, handleWsEvent);

  return { counts, refreshCounts };
}