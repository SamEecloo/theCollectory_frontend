import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserX, Ban, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";

interface Friend {
  _id: string;
  username: string;
  picture?: string;
}

interface BlockedUser {
  _id: string;
  username: string;
  picture?: string;
}

type DialogAction = { type: "remove" | "block"; user: Friend } | null;

export default function Friends() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogAction>(null);

  useEffect(() => {
    Promise.all([api.get("/friends"), api.get("/friends/blocked")])
      .then(([fr, bl]) => {
        setFriends(fr.data);
        setBlocked(bl.data);
      })
      .catch(() => toast.error("Failed to load friends"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!dialog) return;
    const { type, user } = dialog;
    setDialog(null);
    try {
      if (type === "remove") {
        await api.delete(`/friends/${user.username}`);
        setFriends((prev) => prev.filter((f) => f._id !== user._id));
        toast.success(`Removed ${user.username}`);
      } else {
        await api.post(`/friends/block/${user.username}`);
        setFriends((prev) => prev.filter((f) => f._id !== user._id));
        setBlocked((prev) => [...prev, user]);
        toast.success(`Blocked ${user.username}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleUnblock = async (user: BlockedUser) => {
    try {
      await api.delete(`/friends/block/${user.username}`);
      setBlocked((prev) => prev.filter((b) => b._id !== user._id));
      toast.success(`Unblocked ${user.username}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to unblock");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl">Friends</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search friends…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {friends.length === 0 ? "You have no friends yet." : "No friends match your search."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((f) => (
          <div
            key={f._id}
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
          >
            <Avatar
              className="h-9 w-9 shrink-0 cursor-pointer"
              onClick={() => navigate(`/${f.username}`)}
            >
              <AvatarImage src={f.picture} />
              <AvatarFallback>{f.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <button
              className="flex-1 text-left text-sm font-medium hover:underline"
              onClick={() => navigate(`/${f.username}`)}
            >
              @{f.username}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Remove friend"
              onClick={() => setDialog({ type: "remove", user: f })}
            >
              <UserX className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Block user"
              onClick={() => setDialog({ type: "block", user: f })}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {blocked.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Blocked</h2>
          {blocked.map((b) => (
            <div
              key={b._id}
              className="flex items-center gap-3 rounded-lg border px-4 py-3 opacity-60"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={b.picture} />
                <AvatarFallback>{b.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm">@{b.username}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => handleUnblock(b)}
              >
                Unblock
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(dialog)} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.type === "remove" ? "Remove friend?" : "Block user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.type === "remove"
                ? `Remove @${dialog?.user.username} from your friends list?`
                : `Block @${dialog?.user.username}? They won't be able to send you messages.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {dialog?.type === "remove" ? "Remove" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
