import React from "react";
import "./TypingIndicator.css";

const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-indicator" aria-label="Assistant is typing">
      <div className="typing-indicator__bubble">
        <span className="typing-indicator__dot" style={{ animationDelay: "0ms" }} />
        <span className="typing-indicator__dot" style={{ animationDelay: "160ms" }} />
        <span className="typing-indicator__dot" style={{ animationDelay: "320ms" }} />
      </div>
      <span className="typing-indicator__label">Analyzing...</span>
    </div>
  );
};

export default TypingIndicator;
