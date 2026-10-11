// Shared bits between the Chat page and the global notification listener.
//
// The Chat page reports whether it's mounted (so notifications know to fire
// only when the user is elsewhere), and both sides update the tab title with
// the total unread count.

const BASE_TITLE = "frontend";

let chatActive = false;

export function setChatActive(active) {
    chatActive = active;
}

export function isChatActive() {
    return chatActive;
}

export function setUnreadTitle(unread) {
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
}
