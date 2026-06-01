export default function Pagination({ page = 1, totalPages = 1, onPageChange }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => canPrev && onPageChange?.(page - 1)}
        disabled={!canPrev}
        className="px-3 py-2 rounded-xl text-sm font-semibold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:hover:bg-white"
      >
        Prev
      </button>

      <p className="text-xs text-gray-500">
        Page <span className="font-semibold text-gray-800">{page}</span> of{' '}
        <span className="font-semibold text-gray-800">{totalPages}</span>
      </p>

      <button
        type="button"
        onClick={() => canNext && onPageChange?.(page + 1)}
        disabled={!canNext}
        className="px-3 py-2 rounded-xl text-sm font-semibold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:hover:bg-white"
      >
        Next
      </button>
    </div>
  );
}

