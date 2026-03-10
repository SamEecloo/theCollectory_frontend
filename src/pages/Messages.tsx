import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { useRefreshCounts } from "@/context/UnreadCountsContext";

interface Participant {
  _id: string;
  username: string;
  picture?: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: { body: string; sender: Participant };
  lastMessageAt: string;
}

interface Message {
  _id: string;
  sender: Participant;
  body: string;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function ConversationList({
  conversations, activeId, currentUserId, onSelect,
}: {
  conversations: Conversation[];
  activeId?: string;
  currentUserId: string;
  onSelect: (c: Conversation) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
        <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Visit a friend's profile to start a chat</p>
      </div>
    );
  }
  return (
    <div className="divide-y">
      {conversations.map((c) => {
        const other = c.participants.find((p) => p._id !== currentUserId);
        return (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors ${c._id === activeId ? "bg-accent/60" : ""}`}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={other?.picture} />
              <AvatarFallback>{(other?.username || "?")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">@{other?.username}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(c.lastMessageAt)}</span>
              </div>
              {c.lastMessage && (
                <p className="text-xs text-muted-foreground truncate">
                  {c.lastMessage.sender._id === currentUserId ? "You: " : ""}
                  {c.lastMessage.body}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MessageThread({
  conversation, messages, currentUserId, onSend, sending,
}: {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  onSend: (body: string) => void;
  sending: boolean;
}) {
  const other = conversation.participants.find((p) => p._id !== currentUserId);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={other?.picture} />
          <AvatarFallback>{(other?.username || "?")[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm">@{other?.username}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const isMe = m.sender._id === currentUserId;
          return (
            <div key={m._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                <p>{m.body}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {timeAgo(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Messages() {
  const { token } = useAuth();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { refreshCounts } = useRefreshCounts();
  // Track which conversations have already been loaded so we never show
  // the loading spinner again after the first fetch
  const loadedConvos = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUserId(payload.userId);
    } catch {}
  }, [token]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get("/messages/conversations");
      setConversations(res.data);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!conversationId || conversations.length === 0) return;
    const found = conversations.find((c) => c._id === conversationId);
    if (found) openConversation(found);
  }, [conversationId, conversations]);

  const openConversation = async (c: Conversation) => {
    setActiveConversation(c);
    navigate(`/messages/${c._id}`, { replace: true });

    // Only show loader on first open — subsequent opens are instant
    const alreadyLoaded = loadedConvos.current.has(c._id);
    if (!alreadyLoaded) setLoadingMessages(true);

    try {
      const res = await api.get(`/messages/conversations/${c._id}`);
      setMessages(res.data);
      loadedConvos.current.add(c._id);
      refreshCounts();
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (body: string) => {
    if (!activeConversation) return;
    setSending(true);

    // Optimistic: append a temporary message immediately so the UI feels instant
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      sender: { _id: userId, username: "", picture: undefined },
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await api.post(`/messages/conversations/${activeConversation._id}/send`, { body });
      // Replace the optimistic message with the real one from the server
      setMessages((prev) => prev.map((m) => m._id === tempId ? res.data : m));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConversation._id
            ? { ...c, lastMessage: res.data, lastMessageAt: res.data.createdAt }
            : c
        )
      );
    } catch {
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setSending(false);
    }
  };

  useWebSocket(token, (evt) => {
    if (evt.event === "new_message") {
      const { message, conversationId: incomingConvoId } = evt.payload;
      if (activeConversation?._id === incomingConvoId) {
        // Deduplicate: don't add if we already have this message (e.g. our own send)
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === message._id);
          return exists ? prev : [...prev, message];
        });
      }
      setConversations((prev) =>
        prev.map((c) =>
          c._id === incomingConvoId
            ? { ...c, lastMessage: message, lastMessageAt: message.createdAt }
            : c
        )
      );
    }
  });

  return (
    <div className="flex h-[calc(100dvh-65px)] overflow-hidden md:border md:rounded-lg mx-0">
      <div className={`w-full md:w-80 md:border-r flex flex-col shrink-0 ${activeConversation ? "hidden md:flex" : "flex"}`}>
        <div className="px-4 py-3 border-b">
          <h1 className="font-semibold text-sm">Messages</h1>
        </div>
        {loadingConvos ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              activeId={activeConversation?._id}
              currentUserId={userId}
              onSelect={openConversation}
            />
          </div>
        )}
      </div>

      <div className={`flex-1 flex flex-col ${!activeConversation ? "hidden md:flex" : "flex"}`}>
        {activeConversation ? (
          <>
            <button
              className="md:hidden flex items-center gap-1 text-sm text-muted-foreground px-3 pt-3"
              onClick={() => { setActiveConversation(null); navigate("/messages"); }}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {loadingMessages ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
              </div>
            ) : (
              <MessageThread
                conversation={activeConversation}
                messages={messages}
                currentUserId={userId}
                onSend={sendMessage}
                sending={sending}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}