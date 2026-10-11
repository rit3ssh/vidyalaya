// Small shared formatting helpers used across pages.

// Formats an ISO date as e.g. "Nov 5, 2026".
export function formatNoticeDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Converts an ISO date to a yyyy-mm-dd value for <input type="date">,
// compensating for the local timezone offset.
export function toDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

// Formats a 24-hour "HH:mm" string as e.g. "9:00 AM". Returns "" for anything
// else so it's safe to use on optional fields.
export function formatTime(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Formats a "yyyy-mm-dd" key as e.g. "Tue, Nov 10" (local midnight, so the
// day never shifts across timezones).
export function formatDateHeader(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
