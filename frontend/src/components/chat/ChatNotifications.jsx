// Global chat notifications — mounted once in App so they fire even when the
// user is on another page (the Chat page only handles in-page updates).
//
// - Browser Notification when a new message arrives while the tab is hidden or
//   the user is not on the Chat page (requires Notification permission, which
//   the Chat page asks for on first visit).
// - The tab title shows the total unread count, e.g. "(3) frontend".
// - Clicking a notification focuses the window and jumps to the Chat page.

import { useEffect } from "react";
import socket from "../../services/socket.js";
import { getChatConversations } from "../../services/api.js";
import { isChatActive, setUnreadTitle } from "../../services/chatUi.js";

const attachmentLabel = (att) => {
  if (!att) return "";
  return String(att.fileType || "").startsWith("image/") ? "📷 sent a photo" : `📎 sent ${att.fileName || "a file"}`;
};

const ChatNotifications = () => {
  useEffect(() => {
    const refreshUnreadTitle = async () => {
      try {
        const res = await getChatConversations();
        const total = (res.conversations || []).reduce((sum, c) => sum + (c.unread || 0), 0);
        setUnreadTitle(total);
      } catch {
        // silent — the title is cosmetic
      }
    };

    const onChatUpdate = (payload) => {
      refreshUnreadTitle();

      // Only notify when the user can't see the message: tab hidden or on a
      // different page.
      if (document.hidden || !isChatActive()) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;

        const name = payload.senderName || "New message";
        const body =
          payload.text ||
          attachmentLabel(payload.attachment) ||
          "You have a new message";

        const notification = new Notification(name, { body });
        notification.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent("app:navigate", { detail: "Chat" }));
          notification.close();
        };
      }
    };

    // Coming back to the tab clears the badge (the Chat page refreshes it if open).
    const onVisibility = () => {
      if (!document.hidden) refreshUnreadTitle();
    };

    socket.on("chat:update", onChatUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      socket.off("chat:update", onChatUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
};

export default ChatNotifications;
