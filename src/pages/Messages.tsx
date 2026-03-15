import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, ArrowLeft, ImageIcon, Smile, X, Loader2 } from "lucide-react";
import EmojiPicker, { type EmojiClickData, Theme, EmojiStyle } from "emoji-picker-react";
import twemoji from "twemoji";
import api from "@/lib/api";
import { useRefreshCounts } from "@/context/UnreadCountsContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface Participant {
  _id: string;
  username: string;
  picture?: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: { body: string; imageUrl?: string; sender: Participant };
  lastMessageAt: string;
}

interface Message {
  _id: string;
  sender: Participant;
  body: string;
  imageUrl?: string;
  createdAt: string;
}

function TwemojiText({ text, className }: { text: string; className?: string }) {
  const html = twemoji.parse(
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    { folder: "svg", ext: ".svg" }
  );
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ ["--twemoji-size" as string]: "1.2em" }}
    />
  );
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
        const preview = c.lastMessage?.imageUrl && !c.lastMessage?.body
          ? "📷 Image"
          : c.lastMessage?.body || "";
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
              {preview && (
                <p className="text-xs text-muted-foreground truncate">
                  {c.lastMessage?.sender._id === currentUserId ? "You: " : ""}
                  {preview}
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
  messages, currentUserId, onSend, sending,
}: {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  onSend: (body: string, imageUrl?: string) => void;
  sending: boolean;
}) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // data URL
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleEmojiClick = (data: EmojiClickData) => {
    setInput((prev) => prev + data.emoji);
  };

  const EMOTICONS: Record<string, string> = {
    // Happy
    ":-)": "🙂", ":)": "🙂", "=)": "🙂",
    ":-D": "😃", ":D": "😃", "=D": "😃",
    "^_^": "😊",
    // Sad
    ":-(": "😞", ":(": "😞", "=(": "😞",
    // Crying / laughing-crying
    ":'(": "😢", ":')": "😂",
    // Wink
    ";-)": "😉", ";)": "😉",
    // Tongue
    ":-P": "😛", ":P": "😛", ":-p": "😛", ":p": "😛",
    // Surprised
    ":-O": "😮", ":O": "😮", ":-o": "😮", ":o": "😮",
    // Cool
    "B-)": "😎", "B)": "😎",
    // Angel
    "o:)": "😇", "O:)": "😇", "0:)": "😇", "o:-)": "😇", "O:-)": "😇",
    // Devil
    "3:)": "😈", "3:-)": "😈",
    // Angry
    ">:(": "😡", ">:-(": "😡",
    // Kiss
    ":-*": "😘", ":*": "😘",
    // Confused / skeptical
    ":-/": "😕", ":/": "😕", ":-\\": "😕", ":\\": "😕",
    // Neutral
    ":-|": "😐", ":|": "😐", "-_-": "😑",
    // Embarrassed
    ":$": "😳", ":-$": "😳",
    // Zipped mouth
    ":X": "🤐", ":-X": "🤐", ":x": "🤐", ":-x": "🤐",
    // Thumbs
    "(Y)": "👍", "(y)": "👍", "(N)": "👎", "(n)": "👎",
    // Heart
    "<3": "❤️", "</3": "💔",
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Check longest emoticons first to avoid partial matches
    const sorted = Object.keys(EMOTICONS).sort((a, b) => b.length - a.length);
    for (const key of sorted) {
      if (value.endsWith(key)) {
        value = value.slice(0, -key.length) + EMOTICONS[key];
        break;
      }
    }
    setInput(value);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/messages/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.imageUrl as string;
    } catch {
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !imagePreview) return;

    let uploadedUrl: string | undefined;
    if (imagePreview && fileRef.current?.files?.[0]) {
      const url = await uploadImage(fileRef.current.files[0]);
      if (!url) return; // upload failed
      uploadedUrl = url;
    }

    onSend(text, uploadedUrl);
    setInput("");
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        // Swap the file input's file — store as a DataTransfer trick
        const dt = new DataTransfer();
        dt.items.add(file);
        if (fileRef.current) fileRef.current.files = dt.files;
        handleFileSelect(file);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const isMe = m.sender._id === currentUserId;
          return (
            <div key={m._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                {m.imageUrl && (
                  <img
                    src={`${BACKEND_URL}${m.imageUrl}`}
                    alt="attachment"
                    className="rounded-lg max-w-full mb-1 cursor-pointer"
                    style={{ maxHeight: 240 }}
                    onClick={() => window.open(`${BACKEND_URL}${m.imageUrl}`, "_blank")}
                  />
                )}
                {m.body && <TwemojiText text={m.body} />}
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {timeAgo(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mx-4 mb-2 inline-flex">
          <img src={imagePreview} alt="preview" className="h-20 rounded-lg border object-cover" />
          <button
            type="button"
            onClick={() => { setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Compose bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0 relative">
        {/* Emoji picker */}
        <div ref={emojiRef} className="relative">
          <Button type="button" size="icon" variant="ghost" onClick={() => setShowEmoji((v) => !v)}>
            <Smile className="h-5 w-5 text-muted-foreground" />
          </Button>
          {showEmoji && (
            <div className="absolute bottom-12 left-0 z-50">
              <EmojiPicker
                theme={Theme.AUTO}
                emojiStyle={EmojiStyle.TWITTER}
                onEmojiClick={handleEmojiClick}
                lazyLoadEmojis
                height={380}
                width={320}
              />
            </div>
          )}
        </div>

        {/* Image picker */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={uploadingImage}
        >
          {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
        />

        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message…"
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          onPaste={handlePaste}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || uploadingImage || (!input.trim() && !imagePreview)}
        >
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
    if (!conversationId) { setActiveConversation(null); return; }
    if (conversations.length === 0) return;
    const found = conversations.find((c) => c._id === conversationId);
    if (found) openConversation(found);
  }, [conversationId, conversations]);

  const openConversation = async (c: Conversation) => {
    setActiveConversation(c);
    const other = c.participants.find((p) => p._id !== userId);
    navigate(`/messages/${c._id}`, { replace: true, state: { conversationName: other?.username } });

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

  const sendMessage = async (body: string, imageUrl?: string) => {
    if (!activeConversation) return;
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      _id: tempId,
      sender: { _id: userId, username: "", picture: undefined },
      body,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await api.post(`/messages/conversations/${activeConversation._id}/send`, { body, imageUrl });
      setMessages((prev) => prev.map((m) => m._id === tempId ? res.data : m));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConversation._id
            ? { ...c, lastMessage: res.data, lastMessageAt: res.data.createdAt }
            : c
        )
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setSending(false);
    }
  };

  useWebSocket(token, (evt) => {
    if (evt.event === "new_message") {
      const { message, conversationId: incomingConvoId } = evt.payload;
      if (activeConversation?._id === incomingConvoId) {
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
