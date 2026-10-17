export default function Tabs({ tabs = [], active = '', onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange?.(t.key)}
            className="px-4 py-2 rounded-xl text-sm font-extrabold border transition"
            style={{
              background: isActive ? '#00AEEF' : '#FFFFFF',
              color: isActive ? '#FFFFFF' : '#111827',
              borderColor: '#d5d7eb',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

