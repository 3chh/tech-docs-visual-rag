"""Bảng theo dõi hội thoại giữa các thành phần trong một lượt truy vấn."""

import threading
from dataclasses import dataclass, field
from datetime import datetime

MAX_ENTRIES = 200

ICONS = {
    "input": "📥",
    "output": "📤",
    "info": "ℹ️",
    "warning": "⚠️",
    "error": "❌",
}


@dataclass
class Entry:
    timestamp: str
    agent: str
    message_type: str
    content: str
    metadata: dict = field(default_factory=dict)


class ConversationLog:
    """Lưu vết các bước xử lý để hiển thị cho người dùng."""

    def __init__(self):
        self._entries: list[Entry] = []
        self._lock = threading.Lock()

    def add(self, agent: str, message_type: str, content: str, metadata: dict | None = None) -> None:
        with self._lock:
            self._entries.append(
                Entry(
                    timestamp=datetime.now().strftime("%H:%M:%S"),
                    agent=agent,
                    message_type=message_type,
                    content=content,
                    metadata=metadata or {},
                )
            )
            if len(self._entries) > MAX_ENTRIES:
                del self._entries[:-MAX_ENTRIES]

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def entries(self) -> list[Entry]:
        with self._lock:
            return list(self._entries)

    def format(self) -> str:
        entries = self.entries()
        if not entries:
            return "_Chưa có hoạt động nào. Hãy đặt một câu hỏi._"

        lines = []
        for e in entries:
            icon = ICONS.get(e.message_type, "•")
            lines.append(f"`{e.timestamp}` {icon} **{e.agent}** — {e.content}")
        return "\n\n".join(lines)

    def status(self) -> str:
        entries = self.entries()
        if not entries:
            return "🟢 Sẵn sàng"

        last = entries[-1]
        if last.message_type == "error":
            return f"🔴 Lỗi ở {last.agent}"
        if "hoàn tất" in last.content.lower() or "completed" in last.content.lower():
            return "🟢 Hoàn tất"
        return f"🟡 Đang xử lý: {last.agent}"

    def stats(self) -> str:
        entries = self.entries()
        if not entries:
            return "Chưa có số liệu"

        by_agent: dict[str, int] = {}
        errors = 0
        for e in entries:
            by_agent[e.agent] = by_agent.get(e.agent, 0) + 1
            if e.message_type == "error":
                errors += 1

        lines = [f"Tổng sự kiện: {len(entries)}", f"Lỗi: {errors}", "", "Theo thành phần:"]
        lines += [f"  {agent}: {count}" for agent, count in sorted(by_agent.items())]
        return "\n".join(lines)


conversation_log = ConversationLog()
