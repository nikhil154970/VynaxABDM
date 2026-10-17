import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import ChatWindow from "./ChatWindow";
import InputBar from "./InputBar";
import SuggestionChips from "./SuggestionChips";
import AssistantAvatar from "./AssistantAvatar";
import { useAssistantChat, AssistantModule } from "./hooks/useAssistantChat";
import { MODULE_CONFIGS } from "./moduleConfig";
import "./AssistantPanel.css";

interface AssistantPanelProps {
  module?: AssistantModule;
}

const AssistantPanel = ({ module = "pharmacy" }: AssistantPanelProps) => {
  const config = MODULE_CONFIGS[module] || MODULE_CONFIGS.pharmacy;
  const { messages, loading, sendMessage, clearMessages } = useAssistantChat(module);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissedErr, setDismissedErr] = useState("");
  const [forceShowSuggestions, setForceShowSuggestions] = useState(false);

  const showSuggestions = messages.length === 0 || forceShowSuggestions;

  const placeholder =
    module === "patient"
      ? "Ask about prescriptions, bills, appointments..."
      : "Ask about stock, revenue, queue, medicines...";

  const lastError = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.error) return m.error;
    }
    return null;
  }, [messages]);

  const visibleError = lastError && lastError !== dismissedErr ? lastError : null;

  const handleSend = useCallback((text: string) => {
    sendMessage(text, "english");
  }, [sendMessage]);

  const handleSuggestionSelect = useCallback((text: string) => {
    sendMessage(text, "english");
  }, [sendMessage]);

  const prevMessagesLen = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessagesLen.current) {
      if (forceShowSuggestions) setForceShowSuggestions(false);
    }
    prevMessagesLen.current = messages.length;
  }, [messages.length, forceShowSuggestions]);

  return (
    <>
      {!isOpen && (
        <button
          className="assistant-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open Assistant"
        >
          <div className="assistant-fab__sphere-wrap">
            <img
              src="/mytho-sphere.png"
              alt="MythoAI Assistant"
              className="assistant-fab__image"
              draggable={false}
            />
          </div>
          <span className="assistant-fab__pulse" />
          <span className="assistant-fab__pulse assistant-fab__pulse--delay" />
        </button>
      )}

      {isOpen && (
        <div className={`assistant-panel ${isMinimized ? "assistant-panel--minimized" : ""}`}>
          <div className="assistant-panel__header">
            <div className="assistant-panel__header-left">
              <AssistantAvatar size="sm" animated={loading} src="/mqe_logo.png" />
              <div className="assistant-panel__header-info">
                <div className="assistant-panel__title-row">
                  <span className="assistant-panel__title">{config.title}</span>
                  <span className="assistant-panel__badge">AI Assistant</span>
                </div>
                <span className="assistant-panel__subtitle">{config.subtitle}</span>
                <span className="assistant-panel__status">
                  <span className={`assistant-panel__dot ${visibleError ? "assistant-panel__dot--error" : ""}`} />
                  {loading ? "Thinking..." : visibleError ? "Limited" : "Online"}
                </span>
              </div>
            </div>
            <div className="assistant-panel__header-actions">
              <button
                className="assistant-panel__icon-btn"
                onClick={() => { setForceShowSuggestions(true); setIsMinimized(false); setIsOpen(true); }}
                aria-label="Go home"
                title="Home"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 11.5L12 4l9 7.5v7A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-7z" />
                  <path d="M9 21V12h6v9" />
                </svg>
              </button>
              <button
                className="assistant-panel__icon-btn"
                onClick={() => { clearMessages(); setForceShowSuggestions(true); setIsMinimized(false); }}
                aria-label="New chat"
                title="New chat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button
                className="assistant-panel__icon-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                aria-label="Minimize"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
              </button>
              <button
                className="assistant-panel__icon-btn assistant-panel__icon-btn--close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="assistant-panel__body">
              {visibleError && (
                <div className="assistant-panel__error-banner">
                  <svg className="assistant-panel__error-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="13"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div className="assistant-panel__error-banner-text">
                    <strong>Assistant offline</strong>
                    <p>{visibleError}</p>
                  </div>
                  <button className="assistant-panel__error-banner-close" onClick={() => setDismissedErr(lastError || "")} aria-label="Dismiss">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {showSuggestions ? (
                <div className="assistant-panel__welcome">
                  <div className="assistant-panel__welcome-avatar">
                    <AssistantAvatar size="lg" animated />
                    <span className="assistant-panel__welcome-sparkle">&#10022;</span>
                  </div>
                  <h3 className="assistant-panel__welcome-title">
                    Hello! I'm <span className="assistant-panel__welcome-highlight">MythoAI</span>
                  </h3>
                  <p className="assistant-panel__welcome-sub">
                    {config.welcomeMessage}
                  </p>
                  <SuggestionChips onSelect={handleSuggestionSelect} chips={config.suggestions} />
                  <div className="assistant-panel__tip-bar">
                    <span className="assistant-panel__tip-icon">&#128161;</span>
                    <span className="assistant-panel__tip-text">Tip: You can ask in your own words too!</span>
                  </div>
                </div>
              ) : (
                <ChatWindow messages={messages} loading={loading} />
              )}

              <InputBar onSend={handleSend} loading={loading} placeholder={placeholder} />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AssistantPanel;
