import { Search, X } from "lucide-react";

type FilterBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export default function FilterBar({ value, onChange, placeholder = "Rechercher...", className = "" }: FilterBarProps) {
  return (
    <div className={`filter-bar ${className}`}>
      <div className="filter-input">
        <Search size={16} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Filtrer la liste"
        />
        {value ? (
          <button type="button" className="icon-button small" onClick={() => onChange("")} aria-label="Effacer le filtre">
            <X size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
