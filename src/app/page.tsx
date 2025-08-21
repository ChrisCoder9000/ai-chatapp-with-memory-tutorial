"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  memoryId: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRefScrollHook = useRef<HTMLDivElement | null>(null);

  const [conversationId, setConversationId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      memoryId: "test-chat-app-user-1",
    };

    setMessages((prev) => [...prev, userMessage]);

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          memoryId: userMessage.memoryId,
          conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });

      setInput("");

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        role: "assistant",
        memoryId: "test-chat-app-user-1",
      };

      setMessages((p) => [...p, assistantMessage]);

      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          bottomRefScrollHook.current!.scrollIntoView({ behavior: "smooth" });
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.conversationId) {
                setConversationId(parsed.conversationId);
              }
              if (parsed.content) {
                accumulatedContent += parsed.content;
                setMessages((p) =>
                  p.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              }
            } catch {
              continue;
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Request was aborted");
      } else {
        console.error("Error:", error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, there was an error processing your request.",
          memoryId: "unique_user_identifier_123",
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 h-screen flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>Simple Chat App</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="px-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Start a conversation by typing a message below
                </p>
              )}
              {messages.map((message, i) => {
                return (
                  <div
                    key={i}
                    className={cn(
                      message.role === "user" ? "justify-end" : "justify-start",
                      "flex"
                    )}
                  >
                    <div
                      className={`
                      max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }
                    `}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="border-t p-4 mt-auto">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message here..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  if (abortControllerRef.current && isLoading) {
                    abortControllerRef.current.abort();
                  }
                }}
                type="submit"
                disabled={!isLoading && !input.trim()}
              >
                Send
              </Button>
            </form>
          </div>
          <div ref={bottomRefScrollHook}></div>
        </CardContent>
      </Card>
    </div>
  );
}
