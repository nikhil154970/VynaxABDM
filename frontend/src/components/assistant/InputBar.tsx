import React, { useState, useRef, useEffect } from "react";
import VoiceButton from "./VoiceButton";
import "./InputBar.css";

interface InputBarProps {
  onSend: (message: string) => void;
  loading: boolean;
  placeholder?: string;
}

const InputBar: React.FC<InputBarProps> = ({ onSend, loading, placeholder = "Ask about stock, revenue, queue, medicines..." }) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text || loading) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleVoiceTranscript = (transcript: string) => {
    setValue(transcript);
    setTimeout(() => onSend(transcript), 200);
  };

  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus();
    }
  }, [loading]);

  const canSend = value.trim().length > 0 && !loading;

  return (
    <div className="input-bar">
      <div className="input-bar__wrapper">
        <div className="input-bar__spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2.5L13.9 8.1L19.5 10L13.9 11.9L12 17.5L10.1 11.9L4.5 10L10.1 8.1L12 2.5Z"
              fill="currentColor"
            />
            <path
              d="M18.8 2.9L19.7 5.3L22.1 6.2L19.7 7.1L18.8 9.5L17.9 7.1L15.5 6.2L17.9 5.3L18.8 2.9Z"
              fill="currentColor"
              opacity="0.85"
            />
          </svg>
        </div>

        <textarea
          ref={textareaRef}
          className="input-bar__textarea"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          disabled={loading}
          aria-label="Type your message"
        />

        <div className="input-bar__actions">
          <VoiceButton onTranscript={handleVoiceTranscript} disabled={loading} />

          <button
            className={`input-bar__send-btn ${canSend ? "input-bar__send-btn--active" : ""}`}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      <p className="input-bar__hint">
        Press <kbd>Enter</kbd> to send &middot; <kbd>Shift+Enter</kbd> for new line
      </p>
    </div>
  );
};

export default InputBar;
