import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdLocalPharmacy, MdSearch } from 'react-icons/md';
import api from '../../utils/api';

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const MIN_SEARCH = 2;

function mapSearchResults(data) {
  const meds = Array.isArray(data?.medicines) ? data.medicines : [];
  const seen = new Set();
  const out = [];
  for (const m of meds) {
    if (!m?.medicineId || seen.has(m.medicineId)) continue;
    seen.add(m.medicineId);
    out.push({
      medicineId: m.medicineId,
      medicineName: m.medicineName,
    });
  }
  return out;
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   context: {
 *     patientId: string,
 *     doctorId?: string,
 *     tokenNumber: string,
 *     admissionId?: string,
 *     prescriptionId?: string,
 *     patientName?: string,
 *     uhid?: string,
 *   } | null,
 *   prefillItems?: Array<{ medicine?: string, name?: string, dosage?: string, frequency?: string, duration?: string, quantity?: number }>,
 *   onSuccess?: () => void,
 * }} props
 */
export default function SendToPharmacyModal({ open, onClose, context, prefillItems = [], onSuccess }) {
  const [sendItems, setSendItems] = useState([]);
  const [medQuery, setMedQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addQtyByMedId, setAddQtyByMedId] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !context) return;
    setError('');
    setMedQuery('');
    setSearchResults([]);
    setAddQtyByMedId({});
    const prefill = (prefillItems || [])
      .map((m, idx) => ({
        key: `rx-${idx}`,
        medicineId: m.medicineId || '',
        medicineName: String(m?.medicine || m?.name || m?.medicineName || '').trim(),
        dosage: String(m?.dosage || '').trim(),
        frequency: String(m?.frequency || '').trim(),
        duration: String(m?.duration || '').trim(),
        quantity: Math.max(1, Number(m?.quantity) || 1),
      }))
      .filter((x) => x.medicineName);
    setSendItems(prefill);
  }, [open, context, prefillItems]);

  useEffect(() => {
    if (!open) return undefined;
    const q = medQuery.trim();
    if (q.length < MIN_SEARCH) {
      setSearchResults([]);
      return undefined;
    }
    let active = true;
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/pharmacy/billing/inventory/search', { params: { q } });
        if (active) setSearchResults(mapSearchResults(res.data));
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [medQuery, open]);

  const handleAddMedicine = (row) => {
    if (!row?.medicineId) return;
    const qty = Math.max(1, Number(addQtyByMedId[row.medicineId]) || 1);
    setSendItems((prev) => {
      const existing = prev.find((i) => i.medicineId === row.medicineId);
      if (existing) {
        return prev.map((i) =>
          i.medicineId === row.medicineId ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [
        ...prev,
        {
          key: `med-${row.medicineId}`,
          medicineId: row.medicineId,
          medicineName: row.medicineName,
          dosage: '',
          frequency: '',
          duration: '',
          quantity: qty,
        },
      ];
    });
    setAddQtyByMedId((prev) => ({ ...prev, [row.medicineId]: 1 }));
  };

  const handleSubmit = async () => {
    if (!context?.patientId) {
      setError('Patient not found');
      return;
    }
    if (!context?.tokenNumber) {
      setError('Token / IPD number missing');
      return;
    }

    const items = sendItems
      .map((x) => ({
        medicineId: x.medicineId || undefined,
        medicineName: String(x.medicineName || '').trim(),
        dosage: String(x.dosage || '').trim() || undefined,
        frequency: String(x.frequency || '').trim() || undefined,
        duration: String(x.duration || '').trim() || undefined,
        quantity: Number(x.quantity) || 1,
      }))
      .filter((x) => x.medicineName);

    if (!items.length) {
      setError('Add at least one medicine to send');
      return;
    }

    setSending(true);
    setError('');
    try {
      await api.post('/pharmacy/queue', {
        patientId: context.patientId,
        doctorId: context.doctorId || undefined,
        prescriptionId: context.prescriptionId || undefined,
        tokenNumber: String(context.tokenNumber),
        sentAt: new Date().toISOString(),
        items,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send to pharmacy');
    } finally {
      setSending(false);
    }
  };

  if (!open || !context) return null;

  const qLen = medQuery.trim().length;

  return createPortal(
    <div className="pl-modalOverlay" role="dialog" aria-modal="true">
      <div className="pl-modal pl-modalAnimate" style={{ maxWidth: 920 }}>
        <div className="pl-modalHeader">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">Send To Pharmacy</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {context.patientName || 'Patient'}
              {context.uhid ? (
                <>
                  {' '}
                  · UHID <span className="font-mono font-bold text-blue-600">{context.uhid}</span>
                </>
              ) : null}
              {' '}
              · Token <span className="font-mono font-bold text-blue-600">{context.tokenNumber}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="pl-modalClose" title="Close" disabled={sending}>
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        <div className="pl-modalBody">
          {error ? (
            <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            <div className="pl-modalCard">
              <p className="pl-modalCardTitle">Selected medicines</p>
              {sendItems.length ? (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white z-[1]">
                      <tr className="text-left text-gray-500">
                        <th className="pb-2 pr-2">Medicine</th>
                        <th className="pb-2 pr-2 w-[72px]">Qty</th>
                        <th className="pb-2 pr-2">Dosage</th>
                        <th className="pb-2 pr-2">Frequency</th>
                        <th className="pb-2 pr-2">Duration</th>
                        <th className="pb-2 w-[70px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {sendItems.map((it) => (
                        <tr key={it.key} className="border-t" style={{ borderColor: '#e0e7ff' }}>
                          <td className="py-2 pr-2 font-semibold text-gray-900">{it.medicineName}</td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) =>
                                setSendItems((prev) =>
                                  prev.map((x) =>
                                    x.key === it.key
                                      ? { ...x, quantity: Math.max(1, Number(e.target.value || 1)) }
                                      : x
                                  )
                                )
                              }
                              className={`${inputCls} w-16`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={it.dosage}
                              onChange={(e) =>
                                setSendItems((prev) =>
                                  prev.map((x) => (x.key === it.key ? { ...x, dosage: e.target.value } : x))
                                )
                              }
                              className={inputCls}
                              placeholder="Optional"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={it.frequency}
                              onChange={(e) =>
                                setSendItems((prev) =>
                                  prev.map((x) => (x.key === it.key ? { ...x, frequency: e.target.value } : x))
                                )
                              }
                              className={inputCls}
                              placeholder="Optional"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={it.duration}
                              onChange={(e) =>
                                setSendItems((prev) =>
                                  prev.map((x) => (x.key === it.key ? { ...x, duration: e.target.value } : x))
                                )
                              }
                              className={inputCls}
                              placeholder="Optional"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setSendItems((prev) => prev.filter((x) => x.key !== it.key))}
                              className="px-2 py-1 rounded-lg text-[11px] font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Search medicine name (min 2 letters), set quantity, then Add.
                </p>
              )}
            </div>

            <div className="pl-modalCard flex flex-col min-h-0">
              <p className="pl-modalCardTitle">Search medicine</p>
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                  placeholder="Type medicine name…"
                  className={`${inputCls} pl-9`}
                  autoFocus
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">
                Type at least {MIN_SEARCH} characters — results show medicine name only.
              </p>

              <div className="mt-3 flex-1 min-h-0">
                {searchLoading ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Searching…</p>
                ) : qLen < MIN_SEARCH ? (
                  <p className="text-xs text-gray-400 py-6 text-center">Start typing to search medicines</p>
                ) : searchResults.length ? (
                  <ul className="space-y-1.5 max-h-[380px] overflow-auto pr-1">
                    {searchResults.map((r) => (
                      <li
                        key={r.medicineId}
                        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                      >
                        <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate" title={r.medicineName}>
                          {r.medicineName}
                        </p>
                        <label className="flex items-center gap-1 shrink-0 text-[11px] text-gray-500">
                          Qty
                          <input
                            type="number"
                            min={1}
                            value={addQtyByMedId[r.medicineId] ?? 1}
                            onChange={(e) =>
                              setAddQtyByMedId((prev) => ({
                                ...prev,
                                [r.medicineId]: Math.max(1, Number(e.target.value || 1)),
                              }))
                            }
                            className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-900 text-center"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddMedicine(r)}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 transition"
                        >
                          Add
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 py-6 text-center">No medicine found</p>
                )}
              </div>
            </div>
          </div>

          <div className="pl-modalActions">
            <button
              type="button"
              className="pl-actionBtn"
              style={{ background: '#00AEEF', color: '#fff', borderColor: 'transparent' }}
              onClick={handleSubmit}
              disabled={sending}
            >
              <MdLocalPharmacy className="w-4 h-4" /> Send To Pharmacy
            </button>
            <button type="button" className="pl-actionBtn" onClick={onClose} disabled={sending}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
