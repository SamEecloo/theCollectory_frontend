import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Clock, MessageCircle } from "lucide-react";
import api from "@/lib/api";

type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "loading";

interface Props {
  profileUsername: string | undefined;
}

export function AddFriendButton({ profileUsername }: Props) {
  const { username: myUsername, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<FriendStatus>("loading");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSelf = !isAuthenticated || !profileUsername || myUsername === profileUsername;

  useEffect(() => {
    if (isSelf || !profileUsername) return;
    api.get(`/friends/status/${profileUsername}`)
      .then(({ data }) => {
        if (data.status === "none") setStatus("none");
        else if (data.status === "accepted") setStatus("accepted");
        else if (data.status === "pending") {
          setStatus(data.iRequested ? "pending_sent" : "pending_received");
          setFriendshipId(data.friendshipId);
        }
      })
      .catch(() => setStatus("none"));
  }, [profileUsername, isSelf]);

  if (isSelf) return null;

  if (status === "loading") {
    return <Button variant="outline" size="sm" disabled className="w-28 h-8 animate-pulse" />;
  }

  const sendRequest = async () => {
    setBusy(true);
    try {
      await api.post(`/friends/request/${profileUsername}`);
      setStatus("pending_sent");
    } finally {
      setBusy(false);
    }
  };

  const respondToRequest = async (action: "accept" | "decline") => {
    if (!friendshipId) return;
    setBusy(true);
    try {
      await api.patch(`/friends/respond/${friendshipId}`, { action });
      setStatus(action === "accept" ? "accepted" : "none");
    } finally {
      setBusy(false);
    }
  };

  const startChat = async () => {
    setBusy(true);
    try {
      const res = await api.post("/messages/conversations", { recipientUsername: profileUsername });
      navigate(`/messages/${res.data._id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === "none" && (
        <Button size="sm" onClick={sendRequest} disabled={busy}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Add Friend
        </Button>
      )}
      {status === "pending_sent" && (
        <Button size="sm" variant="outline" disabled>
          <Clock className="h-4 w-4 mr-1.5" /> Request Sent
        </Button>
      )}
      {status === "pending_received" && (
        <>
          <Button size="sm" onClick={() => respondToRequest("accept")} disabled={busy}>
            <UserCheck className="h-4 w-4 mr-1.5" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => respondToRequest("decline")} disabled={busy}>
            Decline
          </Button>
        </>
      )}
      {status === "accepted" && (
        <>
          <Button size="sm" variant="outline" disabled>
            <UserCheck className="h-4 w-4 mr-1.5" /> Friends
          </Button>
          <Button size="sm" variant="ghost" onClick={startChat} disabled={busy}>
            <MessageCircle className="h-4 w-4 mr-1.5" /> Message
          </Button>
        </>
      )}
    </div>
  );
}