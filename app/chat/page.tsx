// app/chat/page.tsx
"use client";

import AgentChat from "@/components/agency/AgentChat";

export default function ChatPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <AgentChat />
    </div>
  );
}
