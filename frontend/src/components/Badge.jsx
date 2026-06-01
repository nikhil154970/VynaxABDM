const VARIANTS = {
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export default function Badge({ children, variant = 'gray', className = '' }) {
  const v = VARIANTS[variant] || VARIANTS.gray;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${v} ${className}`}>
      {children}
    </span>
  );
}

