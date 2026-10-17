import { useState, useCallback } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  intent?: string;
  error?: string;
  pdfData?: string;
}

interface AssistantResponse {
  reply: string;
  intent?: string;
  error?: string;
  language?: string;
  pdfData?: string;
}

export type Lang = "english";

export type AssistantModule = "pharmacy" | "patient";

const envBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_ENDPOINT = envBase ? `${envBase}/api/assistant/query` : "/api/assistant/query";

let msgIdCounter = 0;
const newId = () => `msg_${++msgIdCounter}_${Date.now()}`;

export function useAssistantChat(module: AssistantModule = "pharmacy") {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Lang>("english");

  const sendMessage = useCallback(async (text: string, lang?: Lang) => {
    if (!text.trim() || loading) return;
    const activeLang = lang || language;

    const userMsg: Message = {
      id: newId(),
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);

    try {
      const token = localStorage.getItem("patientToken") || localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text.trim(), language: activeLang, module }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          message = errorData.message || errorData.detail || message;
        } catch {
          // Keep the status-based message when the response is not JSON.
        }
        throw new Error(message);
      }

      const data: AssistantResponse = await response.json();

      const aiMsg: Message = {
        id: newId(),
        role: "assistant",
        text: data.reply || "Sorry, I could not process that request.",
        timestamp: new Date(),
        intent: data.intent,
        error: data.error,
        pdfData: data.pdfData,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorText =
        err instanceof DOMException && err.name === "AbortError"
          ? "Assistant request timed out. Please check that the assistant service is running."
          : err instanceof Error
            ? err.message
            : "Unknown error occurred";

      setError(errorText);

      const errMsg: Message = {
        id: newId(),
        role: "assistant",
        text: `⚠️ Sorry, I couldn't connect to the assistant system. Please try again.\n\n_Error: ${errorText}_`,
        timestamp: new Date(),
        intent: "ERROR",
      };

      setMessages((prev) => [...prev, errMsg]);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [loading, language, module]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    language,
    setLanguage,
    sendMessage,
    clearMessages,
  };
}
