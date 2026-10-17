import React from "react";
import { HiSparkles } from "react-icons/hi2";
import { SuggestionChip } from "./moduleConfig";
import "./SuggestionChips.css";

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
  chips: SuggestionChip[];
}

const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSelect, chips }) => {
  return (
    <div className="suggestion-chips">
      <p className="suggestion-chips__label">
        <HiSparkles className="suggestion-chips__label-icon" /> Quick queries
      </p>
      <div className="suggestion-chips__grid">
        {chips.map((chip) => (
          <button
            key={chip.label}
            className="suggestion-chip"
            onClick={() => onSelect(chip.text)}
            type="button"
          >
            <span className="suggestion-chip__icon" style={{ color: chip.color, background: `${chip.color}15` }}>
              {chip.icon}
            </span>
            <div className="suggestion-chip__text">
              <span className="suggestion-chip__label">{chip.label}</span>
              <span className="suggestion-chip__subtitle">{chip.subtitle}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestionChips;
