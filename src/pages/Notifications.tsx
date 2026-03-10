import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, UserPlus, Check, X, MessageCircle } from "lucide-react";
import api from "@/lib/api";
import { useRefreshCounts } from "@/context/UnreadCountsContext";

interface Notification {
  _id: string;
  type: "friend_request" | "friend_accepted" | "message";
  read: boolean;
  data: Record<string, any>;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationIcon({ type }: { type: Notification["type"] }) {
  if (type === "friend_request" || type === "friend_accepted")
    return <UserPlus className="h-4 w-4 text-green-600" />;
  if (type === "message") return <MessageCircle className="h-4 w-4 text-blue-500" />;
  return <Bell className="h-4 w-4 text-muted-foreground" />;
}

export default function Notifications() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const { refreshCounts } = useRefreshCounts();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    return () => {
      api.patch("/notifications/read", {}).catch(() => {});
      refreshCounts();
    };
  }, [fetchNotifications]);

  useWebSocket(token, (evt) => {
    if (evt.event === "notification") {
      setNotifications((prev) => {
        const exists = prev.some((n) => n._id === evt.payload._id);
        return exists ? prev : [evt.payload, ...prev];
      });
    }
  });

  const respondToFriendRequest = async (
    friendshipId: string,
    notifId: string,
    action: "accept" | "decline"
  ) => {
    setResponding(notifId);
    try {
      await api.patch(`/friends/respond/${friendshipId}`, { action });
      setNotifications((prev) => prev.filter((n) => n._id !== notifId));
    } catch {
      // leave notification in place on error
    } finally {
      setResponding(null);
    }
  };

  const renderNotification = (n: Notification) => {
    const isUnread = !n.read;
    return (
      <div
        key={n._id}
        className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
          isUnread ? "bg-accent/30 border-accent" : "border-transparent"
        }`}
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={n.data.senderPicture || n.data.acceptorPicture} />
          <AvatarFallback>
            {(n.data.senderUsername || n.data.acceptorUsername || "?")[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <NotificationIcon type={n.type} />
            <p className="text-sm">
              {n.type === "friend_request" && (
                <><span className="font-medium">@{n.data.senderUsername}</span> sent you a friend request</>
              )}
              {n.type === "friend_accepted" && (
                <><span className="font-medium">@{n.data.acceptorUsername}</span> accepted your friend request</>
              )}
              {n.type === "message" && (
                <><span className="font-medium">@{n.data.senderUsername}</span>: {n.data.preview}</>
              )}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>

          {n.type === "friend_request" && n.data.friendshipId && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={responding === n._id}
                onClick={() => respondToFriendRequest(n.data.friendshipId, n._id, "accept")}
              >
                <Check className="h-3 w-3 mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={responding === n._id}
                onClick={() => respondToFriendRequest(n.data.friendshipId, n._id, "decline")}
              >
                <X className="h-3 w-3 mr-1" /> Decline
              </Button>
            </div>
          )}

          {n.type === "message" && n.data.conversationId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-2"
              onClick={() => navigate(`/messages/${n.data.conversationId}`)}
            >
              View message
            </Button>
          )}
        </div>

        {isUnread && <div className="h-2 w-2 rounded-full bg-red-500 shrink-0 mt-1.5" />}
      </div>
    );
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Notifications</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">{notifications.map(renderNotification)}</div>
      )}
    </div>
  );
}