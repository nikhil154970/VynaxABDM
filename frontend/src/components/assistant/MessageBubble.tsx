import React, { useState } from "react";
import AssistantAvatar from "./AssistantAvatar";
import { Message } from "./hooks/useAssistantChat";
import { useTextToSpeech } from "./hooks/useTextToSpeech";
import "./MessageBubble.css";

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  // Allow React `key` to be passed in JSX without TS error
  key?: React.Key | null;
}

const MessageBubble = ({ message, isLast }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const { speak, stop, speaking, supported, ttsMode } = useTextToSpeech();

  const handleCopy = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard write not supported in this browser.");
      }
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.warn("Failed to copy assistant text:", err);
    }
  };

  const handleDownloadPdf = () => {
    if (!message.pdfData) return;
    const byteString = atob(message.pdfData);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  // Render assistant text with basic markdown-like formatting
  const renderText = (text: string) => {
    // Bold: **text**
    const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part === "\n") return <br key={i} />;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className={`message-bubble-row ${isUser ? "message-bubble-row--user" : "message-bubble-row--ai"} ${isLast ? "message-bubble-row--last" : ""}`}
    >
      {!isUser && (
        <div className="message-bubble__avatar">
          <AssistantAvatar size="xs" />
        </div>
      )}

      <div className="message-bubble__content">
        <div className={`message-bubble ${isUser ? "message-bubble--user" : "message-bubble--ai"}`}>
          {/* Intent tag for AI messages */}
          {!isUser && message.intent && message.intent !== "UNKNOWN" && (
            <span className="message-bubble__intent-tag">
              {message.intent.replace(/_/g, " ")}
            </span>
          )}

          <div className="message-bubble__text">
            {renderText(message.text)}
          </div>
          {message.error && (
            <div className="message-bubble__error">
              <svg className="message-bubble__error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="13"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="message-bubble__error-text">{message.error}</span>
            </div>
          )}
        </div>

        {/* Footer row */}
        <div className={`message-bubble__footer ${isUser ? "message-bubble__footer--user" : ""}`}>
          <span className="message-bubble__time">{formatTime(message.timestamp)}</span>

          {!isUser && supported && (
            <button
              className={`message-bubble__speak-btn ${speaking ? "message-bubble__speak-btn--active" : ""}`}
              onClick={() => speaking ? stop() : speak(message.text)}
              aria-label={speaking ? "Stop speaking" : "Read aloud"}
              title={speaking ? "Stop" : ttsMode === "backend" ? "Listen (Swara Hindi)" : "Play"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {speaking ? (
                  <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
                ) : (
                  <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></>
                )}
              </svg>
            </button>
          )}

          {!isUser && (
            <button
              className="message-bubble__copy-btn"
              onClick={handleCopy}
              aria-label="Copy message"
              title="Copy"
            >
              {copied ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          )}

          {!isUser && message.pdfData && (
            <button
              className="message-bubble__download-btn"
              onClick={handleDownloadPdf}
              aria-label="Download lab report PDF"
              title="Download PDF"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
