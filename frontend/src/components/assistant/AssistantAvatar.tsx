// @ts-ignore allow CSS import
import "./AssistantAvatar.css";

type AvatarSize = "xs" | "sm" | "lg";

interface AssistantAvatarProps {
  size?: AvatarSize;
  animated?: boolean;
  src?: string;
}

const AssistantAvatar = ({
  size = "sm",
  animated = false,
  src = "/mytho-sphere.png",
}: AssistantAvatarProps) => {
  return (
    <div className={`assistant-avatar assistant-avatar--${size} ${animated ? "assistant-avatar--animated" : ""}`}>
      {animated && <span className="assistant-avatar__glow" />}
      <img
        src={src}
        alt="MythoAI"
        className="assistant-avatar__img"
        draggable={false}
      />
    </div>
  );
};

export default AssistantAvatar;
