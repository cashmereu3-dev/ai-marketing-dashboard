// components/ChatBubble.tsx
import React from "react";

interface ChatBubbleProps {
  author: "user" | "agent";
  content: string;
}

export default function ChatBubble({ author, content }: ChatBubbleProps) {
  const isUser = author === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start") + " mb-3"}>
      <div
        className={
          "max-w-xs rounded-xl p-3 text-sm shadow-glow " +
          (isUser
            ? "bg-primary text-white"
            : "bg-glass text-foreground backdrop-blur-md")
        }
      >
        {content}
      </div>
    </div>
  );
}
