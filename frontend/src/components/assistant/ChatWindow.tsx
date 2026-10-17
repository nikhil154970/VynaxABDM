import { useEffect, useRef } from "react";
import { Message } from "./hooks/useAssistantChat";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import "./ChatWindow.css";

interface ChatWindowProps {
  messages: Message[];
  loading: boolean;
}

const ChatWindow = ({ messages, loading }: ChatWindowProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="chat-window">
      <div className="chat-window__messages" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
