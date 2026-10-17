import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MdReceiptLong, MdPrint, MdCheckCircle, MdPerson } from 'react-icons/md';
import api from '../../utils/api';

export default function GenerateOTBill() {
  const location = useLocation();
  const preselectedId = location.state?.preselectedId;
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(null);

  const [otCharges, setOtCharges] = useState('');
  const [surgeonCharges, setSurgeonCharges] = useState('');
  const [anaesthesiaCharges, setAnaesthesiaCharges] = useState('');
  const [equipmentCharges, setEquipmentCharges] = useState('');
  const [miscCharges, setMiscCharges] = useState('');
  const [billDiscount, setBillDiscount] = useState('');
  const [billTax, setBillTax] = useState('');
  const [billNotes, setBillNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [advancePaid, setAdvancePaid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [billResult, setBillResult] = useState(null);
  const [error, setError] = useState('');

  const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const chargeTotal = toNum(otCharges) + toNum(surgeonCharges) + toNum(anaesthesiaCharges) + toNum(equipmentCharges) + toNum(miscCharges);
  const totalAmt = chargeTotal - Math.max(0, toNum(billDiscount)) + Math.max(0, toNum(billTax));
  const initPaid = advancePaid === '' ? totalAmt : Math.min(toNum(advancePaid), totalAmt);
  const pendingAmt = totalAmt - initPaid;

  const fetchPending = async (q = '') => {
    setLoading(true);
    try {
      const params = { status: 'OT_REQUEST_CREATED', limit: 100 };
      if (q.trim()) params.q = q.trim();
      const res = await api.get('/receptionist/ot', { params });
      setPatients(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchPending(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (preselectedId && patients.length > 0 && !selected) {
      const match = patients.find(p => p.id === preselectedId);
      if (match) selectPatient(match);
    }
  }, [patients, preselectedId]);

  const selectPatient = (req) => {
    setSelected(req);
    setBillResult(null);
    setError('');
    setOtCharges(''); setSurgeonCharges(''); setAnaesthesiaCharges('');
    setEquipmentCharges(''); setMiscCharges(''); setBillDiscount(''); setBillTax('');
    setBillNotes('');
  };

  const clearSelection = () => {
    setSelected(null);
    setBillResult(null);
    setError('');
  };

  const handleGenerate = async () => {
    if (chargeTotal === 0) { setError('Koi charge to daalo bhai'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/receptionist/ot/${selected.id}/generate-and-approve`, {
        otCharges: toNum(otCharges), surgeonCharges: toNum(surgeonCharges),
        anaesthesiaCharges: toNum(anaesthesiaCharges), equipmentCharges: toNum(equipmentCharges),
        miscellaneousCharges: toNum(miscCharges),
        discountAmount: toNum(billDiscount), taxAmount: toNum(billTax),
        notes: billNotes || undefined,
        initialPaid: Math.round(initPaid),
        paymentMode,
      });
      setBillResult(res.data);
      fetchPending();
    } catch (err) {
      setError(err?.response?.data?.message || 'Bill generate karte time error');
    } finally {
      setSubmitting(false);
    }
  };

  const printSlip = () => {
    if (!billResult?.bill || !selected) return;
    const bill = billResult.bill;
    const win = window.open('', '_blank');
    if (!win) return;
    const lines = (bill.lineItems || []).map((li) =>
      `<tr><td>${li.description}</td><td style="text-align:center">${li.quantity}</td><td style="text-align:right">₹${li.unitPrice}</td><td style="text-align:right">₹${li.lineTotal}</td></tr>`
    ).join('');
    const paidLabel = bill.status === 'PAID' ? 'Fully Paid' : bill.status === 'PARTIAL' ? 'Partially Paid' : 'Pending';
    const approvedText = '✅ Approved For OT';
    const pendingAmt = Math.max(0, bill.totalAmount - bill.paidAmount);
    win.document.write(`<html><head><title>OT Bill ${bill.billNumber}</title>
    <style>body{font-family:sans-serif;padding:20px;color:#1e293b}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #e2e8f0;text-align:left}th{background:#f8faff}</style>
    </head><body>
    <h2>VyanX Hospital Management System</h2>
    <h3>OT Bill Slip</h3>
    <p><strong>Bill:</strong> ${bill.billNumber} | <strong>Status:</strong> ${bill.status} (${paidLabel})</p>
    <p><strong>Patient:</strong> ${selected.patient?.name || '—'} (${selected.uhid || '—'})</p>
    <p><strong>Surgery:</strong> ${selected.surgeryRecommendation || '—'}</p>
    <p><strong>Doctor:</strong> ${selected.doctor?.user?.name || '—'} | <strong>Nurse:</strong> ${selected.nurse?.name || '—'}</p>
    <h3>Charges</h3>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
    <p><strong>Subtotal:</strong> ₹${bill.subtotalAmount} | <strong>Discount:</strong> ₹${bill.discountAmount} | <strong>Tax:</strong> ₹${bill.taxAmount}</p>
    <p style="font-size:16px;font-weight:700;">Total: ₹${bill.totalAmount} | Paid: ₹${bill.paidAmount} | Pending: ₹${Math.max(0, bill.totalAmount - bill.paidAmount)}</p>
    <p style="margin-top:4px;font-weight:600;color:#15803d">${approvedText}</p>
    ${pendingAmt > 0 ? `<p style="margin-top:4px;font-size:13px;color:#b45309">OT approved — ₹${pendingAmt} balance pending on bill</p>` : ''}
    <p style="margin-top:30px;font-size:12px;color:#94a3b8">Generated by VyanX Hospital Management System</p>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div style={{ padding: '18px 18px 26px', color: '#0f172a' }}>
      <div style={{ marginBottom: 16 }}>
    
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by Patient Name, UHID, Request #..."
          style={{ marginTop: 12, width: '100%', maxWidth: 480, height: 40, borderRadius: 12, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
      ) : patients.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #94a3b8', borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
          <MdCheckCircle size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>Koi pending OT patient nahi hai</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Nurse dwara create kiye gaye OT request yahan dikhenge</p>
        </div>
      ) : !selected ? (
        /* Patient List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {patients.map((req) => (
            <div key={req.id}
              onClick={() => selectPatient(req)}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdPerson size={20} color="#3b82f6" />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                      {req.patient?.name || 'Unknown'} <span style={{ fontWeight: 400, color: '#64748b', fontFamily: 'monospace' }}>#{req.uhid}</span>
                    </p>
                  </div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: 'rgba(99,102,241,0.10)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.22)' }}>
                  Bill Pending
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span><strong>Surgery:</strong> {req.surgeryRecommendation}</span>
                <span><strong>Doctor:</strong> {req.doctor?.user?.name || '—'}</span>
                <span><strong>Nurse:</strong> {req.nurse?.name || '—'}</span>
                <span><strong>IPD:</strong> {req.admission?.ipdNumber || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      ) : billResult ? (
        /* Success */
        <div style={{ border: '1px solid #bbf7d0', borderRadius: 14, padding: 24, background: '#f0fdf4', textAlign: 'center' }}>
          <MdCheckCircle size={40} color="#15803d" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#15803d' }}>Bill Generate Ho Gaya</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#166534' }}>
            Bill: {billResult.bill.billNumber} | Total: ₹{billResult.bill.totalAmount} | Paid: ₹{billResult.bill.paidAmount}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#15803d' }}>
            ✅ Approved For OT — request OT portal pe bhej di gayi
          </p>
          {billResult.pendingAmount > 0 ? (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b45309' }}>
              Payment pending: <strong>₹{billResult.pendingAmount}</strong> (Paid: ₹{billResult.bill.paidAmount} / Total: ₹{billResult.bill.totalAmount})
            </p>
          ) : (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#166534' }}>Bill fully paid</p>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={printSlip}
              style={{ height: 40, padding: '0 24px', borderRadius: 10, border: '1px solid #15803d', background: '#fff', color: '#15803d', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdPrint /> Print Slip
            </button>
            <button onClick={clearSelection}
              style={{ height: 40, padding: '0 24px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Wapas List Mein Jaye
            </button>
          </div>
        </div>
      ) : (
        /* Patient Details + Billing Form */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={clearSelection}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#64748b' }}>
              ← Wapas
            </button>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{selected.patient?.name} (#{selected.uhid})</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#fff' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Patient Details</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div><strong>Patient Name:</strong> {selected.patient?.name}</div>
                <div><strong>UHID:</strong> {selected.uhid}</div>
                <div><strong>IPD Number:</strong> {selected.admission?.ipdNumber || '—'}</div>
                <div><strong>Doctor Name:</strong> {selected.doctor?.user?.name || '—'}</div>
                <div><strong>Nurse Name:</strong> {selected.nurse?.name || '—'}</div>
              </div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#fff' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>OT Request Details</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div><strong>Diagnosis:</strong> {selected.diagnosis}</div>
                <div><strong>Surgery Recommendation:</strong> {selected.surgeryRecommendation}</div>
                <div><strong>Priority:</strong> {selected.priority}</div>
                <div><strong>Expected OT Date:</strong> {new Date(selected.expectedSurgeryDate).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#fff' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>OT Billing Form</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'OT Charges (₹)', val: otCharges, set: setOtCharges },
                { label: 'Surgeon Charges (₹)', val: surgeonCharges, set: setSurgeonCharges },
                { label: 'Anaesthesia Charges (₹)', val: anaesthesiaCharges, set: setAnaesthesiaCharges },
                { label: 'Equipment Charges (₹)', val: equipmentCharges, set: setEquipmentCharges },
                { label: 'Miscellaneous Charges (₹)', val: miscCharges, set: setMiscCharges },
                { label: 'Discount (₹)', val: billDiscount, set: setBillDiscount },
                { label: 'Tax (₹)', val: billTax, set: setBillTax },
                { label: 'Total Amount (₹)', val: totalAmt, readOnly: true },
              ].map((f) => (
                <div key={f.label}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{f.label}</label>
                  <input type="number" min="0" readOnly={f.readOnly}
                    value={f.readOnly ? f.val : (f.val === '' && !f.readOnly ? '' : f.val)}
                    onChange={(e) => f.set(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
                    style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 13, width: '100%', background: f.readOnly ? '#f8fafc' : '#fff', fontWeight: f.readOnly ? 700 : 400 }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 13, width: '100%', background: '#fff' }}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Insurance">Insurance</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Advance Payment (₹)</label>
                  <input type="number" min="0" value={advancePaid} placeholder="Full payment by default"
                    onChange={(e) => setAdvancePaid(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0).toString())}
                    style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 13, width: '100%' }} />
                </div>
              </div>
              {totalAmt > 0 && (
                <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span><strong>Total:</strong> ₹{totalAmt}</span>
                  <span><strong>Paying:</strong> ₹{initPaid}</span>
                  <span><strong>Pending:</strong> ₹{pendingAmt}</span>
                  <span style={{ color: pendingAmt > 0 ? '#b45309' : '#15803d', fontWeight: 600 }}>{pendingAmt > 0 ? '⏳ Partial Payment' : '✅ Full Payment'}</span>
                </div>
              )}
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Notes (optional)</label>
              <input value={billNotes} onChange={(e) => setBillNotes(e.target.value)}
                style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 13, width: '100%' }} />
            </div>
            {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={clearSelection}
                style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#475569' }}>
                Cancel
              </button>
              <button onClick={handleGenerate} disabled={submitting || chargeTotal === 0}
                style={{ height: 38, padding: '0 20px', borderRadius: 10, border: 'none', background: chargeTotal === 0 ? '#cbd5e1' : '#059669', color: '#fff', cursor: chargeTotal === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdReceiptLong /> {submitting ? 'Generating...' : 'Generate OT Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
