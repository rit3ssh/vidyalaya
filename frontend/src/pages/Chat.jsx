import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../services/auth.context.jsx";
import socket from "../services/socket.js";
import { setChatActive, setUnreadTitle } from "../services/chatUi.js";
import {
  getChatPeople,
  getChatConversations,
  getChatMessages,
  sendChatMessage,
  getOnlineUsers,
} from "../services/api.js";

// Role badge colors, matched to the app's palette.
const ROLE_STYLE = {
  SCHOOL_ADMIN: "bg-purple-50 text-purple-700",
  TEACHER: "bg-emerald-50 text-emerald-700",
  STUDENT: "bg-blue-50 text-blue-700",
  PARENT: "bg-amber-50 text-amber-700",
};
const ROLE_LABEL = {
  SCHOOL_ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

const roleBadge = (role) => ROLE_STYLE[role] || "bg-slate-100 text-slate-600";

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const PaperclipIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

// "Firstname L." short form for the thread header avatar.
const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

// Compact timestamp for bubbles: time for today, else short date.
const bubbleTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
};

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// The attach picker accepts what the backend whitelists (images, PDFs, docs…).
const ACCEPT_TYPES =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Small avatar with an online dot (module-level so it isn't recreated per render).
// Deterministic color per name, so a person keeps their avatar hue everywhere.
const avatarColor = (name = "") => {
  const palette = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return palette[h % palette.length];
};

const Avatar = ({ person, online = false, size = "w-10 h-10" }) => (
  <div className={`${size} shrink-0 relative`}>
    <div
      className={`w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor(person?.name)}`}
    >
      {initials(person?.name)}
    </div>
    {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
  </div>
);

const PersonMeta = ({ person }) => (
  <>
    <p className="font-medium text-slate-700 text-sm truncate">{person?.name || "Unknown"}</p>
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${roleBadge(person?.role)}`}>
        {ROLE_LABEL[person?.role] || person?.role}
      </span>
      {person?.className && (
        <span className="text-[11px] text-slate-400">
          {person.className}
          {person.section ? ` ${person.section}` : ""}
        </span>
      )}
      {person?.designation && <span className="text-[11px] text-slate-400">{person.designation}</span>}
    </div>
  </>
);

const Chat = () => {
  const { user } = useAuth();
  const me = user?.user_id || user?._id; // login response uses user_id

  const [conversations, setConversations] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeOther, setActiveOther] = useState(null); // the other user's info
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search (replaces the old "New Chat" button/modal).
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  // Live state
  const [connected, setConnected] = useState(socket.connected);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [typingOther, setTypingOther] = useState(false);

  // Composer
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // { file, previewUrl }

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await getChatConversations();
      const list = Array.isArray(res.conversations) ? res.conversations : [];
      setConversations(list);
      setUnreadTitle(list.reduce((sum, c) => sum + (c.unread || 0), 0));
    } catch {
      // silent — refreshed on socket events; don't spam errors
    }
  }, []);

  const loadThread = useCallback(
    async (otherUserId, otherInfo) => {
      try {
        const res = await getChatMessages(otherUserId);
        setMessages(Array.isArray(res.messages) ? res.messages : []);
        setActiveOther(otherInfo);
        // Opening a thread refreshes the unread badges too.
        loadConversations();
        scrollToBottom();
      } catch (err) {
        setError(err.response?.data?.message || err.response?.data?.error || "Failed to load messages");
      }
    },
    [loadConversations, scrollToBottom]
  );

  const openConversation = useCallback(
    (conv) => {
      setError("");
      loadThread(conv.other.userId, conv.other);
    },
    [loadThread]
  );

  const startChatWith = useCallback(
    (person) => {
      setError("");
      // Leaving the search active would keep the left column stuck on results
      // instead of showing the live conversation list.
      setSearchQuery("");
      setRoleFilter("");
      setClassFilter("");
      loadThread(person.userId, person);
    },
    [loadThread]
  );

  // Initial load: conversations + people directory + online users.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      try {
        const [convRes, peopleRes, onlineRes] = await Promise.all([
          getChatConversations(),
          getChatPeople(),
          getOnlineUsers(),
        ]);
        if (cancelled) return;
        setConversations(Array.isArray(convRes.conversations) ? convRes.conversations : []);
        setPeople(Array.isArray(peopleRes.people) ? peopleRes.people : []);
        setOnlineIds(new Set((onlineRes.online || []).map(String)));
        // Auto-open the most recent conversation with unread messages.
        const first = (convRes.conversations || []).find((c) => c.unread > 0) || convRes.conversations?.[0];
        if (first?.other) {
          loadThread(first.other.userId, first.other);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.response?.data?.error || "Failed to load chats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    // Browser notifications: ask permission while the user is engaging with chat.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setChatActive(true);
    return () => {
      cancelled = true;
      setChatActive(false);
    };
  }, [loadThread]);

  // Socket listeners: messages, presence, typing, connection state.
  useEffect(() => {
    const refreshThread = () => {
      if (!activeOther?.userId) return;
      getChatMessages(activeOther.userId)
        .then((res) => {
          setMessages(Array.isArray(res.messages) ? res.messages : []);
          scrollToBottom();
        })
        .catch(() => {});
    };

    const onChatUpdate = (payload) => {
      loadConversations();
      // Refresh the open thread when the push is about it. The payload's
      // otherUserId is the *recipient* from the sender's perspective, so:
      //  - sender viewing the thread:  otherUserId === activeOther ✓
      //  - recipient viewing the thread: senderId === activeOther ✓
      const isAboutActiveThread =
        activeOther?.userId &&
        (String(payload.senderId) === String(activeOther.userId) ||
          String(payload.otherUserId) === String(activeOther.userId));
      if (isAboutActiveThread) {
        refreshThread();
      }
    };

    const onPresence = (payload) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(String(payload.userId));
        else next.delete(String(payload.userId));
        return next;
      });
    };

    const onTyping = (payload) => {
      if (activeOther?.userId && String(payload.fromUserId) === String(activeOther.userId)) {
        setTypingOther(Boolean(payload.isTyping));
        if (payload.isTyping) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTypingOther(false), 3000);
        }
      }
    };

    // On (re)connect, catch up on anything missed while offline.
    const onConnect = () => {
      setConnected(true);
      loadConversations();
      refreshThread();
    };
    const onDisconnect = () => setConnected(false);

    socket.on("chat:update", onChatUpdate);
    socket.on("chat:presence", onPresence);
    socket.on("chat:typing", onTyping);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("chat:update", onChatUpdate);
      socket.off("chat:presence", onPresence);
      socket.off("chat:typing", onTyping);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      clearTimeout(typingTimerRef.current);
    };
  }, [activeOther?.userId, loadConversations, scrollToBottom]);

  // Tell the other side we're typing (throttled to ~1/sec while typing).
  const emitTyping = useCallback(
    (isTyping) => {
      if (!activeOther?.userId) return;
      const now = Date.now();
      if (isTyping && now - lastTypingSentRef.current < 1200) return;
      lastTypingSentRef.current = now;
      socket.emit("chat:typing", { toUserId: activeOther.userId, isTyping });
    },
    [activeOther]
  );

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clean up any previous pending file's preview URL.
    setPendingFile((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null };
    });
    e.target.value = "";
  };

  const clearPendingFile = () => {
    setPendingFile((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !pendingFile) || !activeOther?.userId || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await sendChatMessage(activeOther.userId, { text, file: pendingFile?.file });
      setDraft("");
      clearPendingFile();
      emitTyping(false);
      // Show the server-confirmed message immediately instead of waiting for
      // another fetch round trip.
      const sent = res?.message;
      if (sent) {
        setMessages((prev) =>
          prev.some((m) => String(m.messageId) === String(sent.messageId)) ? prev : [...prev, sent]
        );
        scrollToBottom();
      }
      // Background refresh keeps ordering and read receipts accurate.
      getChatMessages(activeOther.userId)
        .then((r) => setMessages(Array.isArray(r.messages) ? r.messages : []))
        .catch(() => {});
      loadConversations();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const isOnline = (userId) => onlineIds.has(String(userId));

  // Search: filter the scoped people list by name, role and class.
  const classOptions = useMemo(() => {
    const set = new Set();
    people.forEach((p) => {
      if (p.className) set.add(`${p.className}${p.section ? ` ${p.section}` : ""}`);
    });
    return [...set].sort();
  }, [people]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return people.filter((p) => {
      if (roleFilter && p.role !== roleFilter) return false;
      const pClass = p.className ? `${p.className}${p.section ? ` ${p.section}` : ""}` : "";
      if (classFilter && pClass !== classFilter) return false;
      if (!q) return true;
      const haystack = `${p.name} ${ROLE_LABEL[p.role] || p.role} ${p.className || ""} ${p.section || ""} ${p.designation || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [people, searchQuery, roleFilter, classFilter]);

  const isSearching = searchQuery.trim() !== "" || roleFilter !== "" || classFilter !== "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading chats…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Chat</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                connected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
              />
              {connected ? "Live" : "Reconnecting…"}
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            Search for someone to chat with — classmates, teachers, parents and staff, scoped to your role.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 ml-4">
            <XIcon />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ── Left column: search + conversations ── */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, role or class…"
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <XIcon />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex-1 px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 bg-white"
              >
                <option value="">All roles</option>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="flex-1 px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 bg-white"
              >
                <option value="">All classes</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isSearching ? (
            /* ── Search results ── */
            filteredPeople.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-sm">No one matches your search.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
                {filteredPeople.map((p) => (
                  <li key={String(p.userId)}>
                    <button
                      onClick={() => startChatWith(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <Avatar person={p} online={isOnline(p.userId)} />
                      <div className="min-w-0 flex-1">
                        <PersonMeta person={p} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : conversations.length === 0 ? (
            /* ── Empty state ── */
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">No conversations yet.</p>
              <p className="text-xs mt-1">Use the search above to find someone to chat with.</p>
            </div>
          ) : (
            /* ── Conversation list ── */
            <ul className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
              {conversations.map((conv) => {
                const other = conv.other || {};
                const isActive = activeOther?.userId && String(activeOther.userId) === String(other.userId);
                return (
                  <li key={String(conv.conversationId)}>
                    <button
                      onClick={() => openConversation(conv)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive ? "bg-blue-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <Avatar person={other} online={isOnline(other.userId)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-700 text-sm truncate">{other.name || "Unknown"}</p>
                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-slate-400 shrink-0">{bubbleTime(conv.lastMessageAt)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-400 truncate">{conv.lastMessage || "No messages yet"}</p>
                          {conv.unread > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                              {conv.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Thread ── */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {!activeOther ? (
            <div className="text-center py-24 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm">Search for someone or pick a conversation to start chatting.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                <button onClick={() => setActiveOther(null)} className="lg:hidden p-1 text-slate-400 hover:text-slate-600">
                  <BackIcon />
                </button>
                <Avatar person={activeOther} size="w-9 h-9" online={isOnline(activeOther.userId)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm truncate">{activeOther.name}</p>
                    {isOnline(activeOther.userId) && (
                      <span className="text-[10px] font-medium text-emerald-600">● Online</span>
                    )}
                  </div>
                  {typingOther ? (
                    <p className="text-xs text-blue-600 mt-0.5 animate-pulse">
                      {activeOther.name.split(" ")[0]} is typing…
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${roleBadge(activeOther.role)}`}>
                        {ROLE_LABEL[activeOther.role] || activeOther.role}
                      </span>
                      {activeOther.className && (
                        <span className="text-[11px] text-slate-400">
                          {activeOther.className}
                          {activeOther.section ? ` ${activeOther.section}` : ""}
                        </span>
                      )}
                      {activeOther.designation && <span className="text-[11px] text-slate-400">{activeOther.designation}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="px-5 py-4 space-y-3 h-[420px] overflow-y-auto bg-slate-50/40">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 pt-16">No messages yet — say hello!</p>
                ) : (
                  messages.map((m) => {
                    const mine = String(m.senderId) === String(me);
                    const att = m.attachment;
                    const isImage = att && String(att.fileType).startsWith("image/");
                    return (
                      <div key={String(m.messageId)} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                            mine
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-white text-slate-700 border border-slate-100 rounded-bl-md"
                          }`}
                        >
                          {isImage ? (
                            <a href={att.fileUrl} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={att.fileUrl}
                                alt={att.fileName || "attachment"}
                                className="rounded-xl max-h-60 max-w-full object-cover"
                              />
                            </a>
                          ) : att ? (
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-1 ${
                                mine ? "bg-blue-500/40 hover:bg-blue-500/60" : "bg-slate-100 hover:bg-slate-200"
                              }`}
                            >
                              <FileIcon />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium truncate max-w-[220px]">{att.fileName}</span>
                                <span className={`block text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                                  {formatBytes(att.fileSize)}
                                </span>
                              </span>
                            </a>
                          ) : null}
                          {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                          <p className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? "text-blue-200" : "text-slate-400"}`}>
                            {bubbleTime(m.createdAt)}
                            {mine && (
                              <span title={m.read ? "Read" : "Sent"}>{m.read ? "✓✓" : "✓"}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                {pendingFile && (
                  <div className="mb-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                    {pendingFile.previewUrl ? (
                      <img src={pendingFile.previewUrl} alt="preview" className="h-12 w-12 object-cover rounded-lg" />
                    ) : (
                      <span className="h-12 w-12 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center">
                        <FileIcon />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 truncate">{pendingFile.file.name}</p>
                      <p className="text-[10px] text-slate-400">{formatBytes(pendingFile.file.size)}</p>
                    </div>
                    <button type="button" onClick={clearPendingFile} className="p-1 text-slate-400 hover:text-slate-600">
                      <XIcon />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept={ACCEPT_TYPES}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Attach a file or image"
                    className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <PaperclipIcon />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      emitTyping(true);
                    }}
                    onBlur={() => emitTyping(false)}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-shadow"
                  />
                  <button
                    type="submit"
                    disabled={(!draft.trim() && !pendingFile) || sending}
                    className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Send"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <SendIcon />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
