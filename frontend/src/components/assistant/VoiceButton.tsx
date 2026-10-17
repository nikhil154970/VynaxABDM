import React, { useCallback } from "react";
import { useVoiceInput } from "./hooks/useVoiceInput";
import "./VoiceButton.css";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscript, disabled = false }) => {
  const { isListening, isSupported, startListening, stopListening, error } = useVoiceInput({
    onResult: onTranscript,
    language: "en-IN",
  });

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  if (!isSupported) return null;

  return (
    <div className="voice-btn-wrapper">
      <button
        className={`voice-btn ${isListening ? "voice-btn--active" : ""}`}
        onClick={handleClick}
        disabled={disabled && !isListening}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        title={error || (isListening ? "Click to stop" : "Click to speak")}
        type="button"
      >
        {/* Ripple rings when active */}
        {isListening && (
          <>
            <span className="voice-btn__ring voice-btn__ring--1" />
            <span className="voice-btn__ring voice-btn__ring--2" />
          </>
        )}

        {/* Mic Icon */}
        <svg
          className="voice-btn__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0014 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="9" y1="22" x2="15" y2="22" />
        </svg>
      </button>

      {isListening && (
        <span className="voice-btn__label">Listening...</span>
      )}
    </div>
  );
};

export default VoiceButton;
