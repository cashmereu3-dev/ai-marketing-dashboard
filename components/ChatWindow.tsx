// components/ChatWindow.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBubble from "@/components/ChatBubble";
import { generateChatCompletion } from "@/lib/openai";

interface Message {
  id: string;
  author: "user" | "agent";
  content: string;
  created_at: string;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Load existing messages on mount
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data) setMessages(data as any);
    };
    fetchMessages();

    // Subscribe to realtime inserts
    const subscription = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const userMsg = { author: "user", content: input } as Omit<Message, "id" | "created_at">;
    // Insert user message
    const { error: errUser } = await supabase.from("messages").insert(userMsg);
    if (errUser) console.error(errUser);
    // Generate agent reply (mock or real)
    try {
      const reply = await generateChatCompletion([
        { role: "user", content: input },
      ]);
      await supabase.from("messages").insert({ author: "agent", content: reply });
    } catch (e) {
      console.error(e);
    }
    setInput("");
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full p-4 bg-background">
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} author={msg.author} content={msg.content} />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 border border-gray-300 rounded px-3 py-2 bg-glass focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded hover:opacity-90 transition"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
