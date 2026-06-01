import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../utils/api';
import { printBillingSlip } from '../../../utils/printBillingSlip';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';
import './DischargeDocuments.css';

function money(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN')}`;
}

export default function DischargeDocuments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [admission, setAdmission] = useState(null);
  const [clearances, setClearances] = useState(null);
  const [printingBillId, setPrintingBillId] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    try {
      const [admRes, clrRes] = await Promise.all([
        api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`),
        api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-clearances`),
      ]);
      const adm = admRes?.data?.admission;
      const clr = clrRes?.data;
      if (!adm || !clr) {
        setAdmission(null);
        setClearances(null);
        setErr('Could not load admission or clearance data.');
        return;
      }
      // Allow document generation step when all clear OR when discharge-with-dues path is allowed.
      if (!clr.allClear && !clr.mayDischargeWithBillingDues) {
        navigate(`/dashboard/reception/ipd/discharge/process/${encodeURIComponent(id)}`, {
          replace: true,
          state: {
            patient: {
              id: adm.id,
              name: adm.patient?.name || '',
              uhid: adm.patient?.uhid || '',
              ward: clr.ward,
              bed: clr.bed,
              dischargeApproved: true,
              approvedBy: '—',
              approvalTime: adm.dischargeRequestedAt,
              doctor: adm.doctor?.user?.name || '',
            },
            clearanceBlocked: true,
            clearanceMessage: 'Clear dues to open documents.',
          },
        });
        return;
      }
      setAdmission(adm);
      setClearances(clr);
    } catch (e) {
      setAdmission(null);
      setClearances(null);
      setErr(e?.response?.data?.message || e?.message || 'Could not load documents step.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const printBill = async (billId) => {
    if (!billId) return;
    setPrintingBillId(billId);
    try {
      const res = await api.get(`/receptionist/billing/${encodeURIComponent(billId)}`);
      const b = res?.data;
      if (!b) return;
      await printBillingSlip({
        billId: b.billNumber || b.id,
        data: {
          visitType: b.visitType,
          billNumber: b.billNumber || b.id,
          patientName: b.patientName,
          uhid: b.uhid,
          mobile: b.mobile,
          doctorName: b.doctorName,
          createdAt: b.date || b.createdAt,
          items: b.items || [],
          totals: {
            subtotal: b.subtotal ?? b.total,
            discount: b.discount ?? 0,
            taxAmt: b.tax ?? 0,
            total: b.total,
            paid: b.paid,
            pending: b.pending,
          },
          paymentMode: b.paymentMode,
          paymentStatus: b.paymentStatus,
          notes: b.notes,
        },
      });
    } finally {
      setPrintingBillId('');
    }
  };

  const patientId = admission?.patient ? admission.patient.id || clearances?.patient?.id : clearances?.patient?.id;
  const clearedBills = Array.isArray(clearances?.clearedBills) ? clearances.clearedBills : [];

  if (loading) {
    return (
      <div className="dd-root">
        <div className="dd-shell">
          <p className="dd-muted" style={{ padding: 24 }}>
            Loading document workspace…
          </p>
        </div>
      </div>
    );
  }

  if (err || !admission || !clearances) {
    return (
      <div className="dd-root">
        <div className="dd-shell">
          <button type="button" className="dd-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div className="dd-alert" role="alert">
            {err || 'Unable to open this step.'}
          </div>
        </div>
      </div>
    );
  }

  const p = admission.patient || {};

  return (
    <div className="dd-root">
      <div className="dd-shell">
        <button type="button" className="dd-back" onClick={() => navigate(`/dashboard/reception/ipd/discharge/process/${encodeURIComponent(id)}`)}>
          ← Back to clearances
        </button>

        <header className="dd-hero">
          <p className="dd-stepHint">Step 2 of 3 · Document generation</p>
          <h1>Discharge documents</h1>
          <div className="dd-hero-meta">
            <span className="dd-pill">
              <strong>{p.name || '—'}</strong>
            </span>
            <span className="dd-pill dd-mono">{p.uhid || '—'}</span>
            <span className="dd-pill">
              {clearances.ward} / {clearances.bed}
            </span>
          </div>
        </header>

        <div className="dd-grid dd-grid--single">
          <section className="dd-card">
            <div className="dd-card-head">
              <h2>Final bills (settled)</h2>
            </div>
            <div className="dd-card-body">
              {clearedBills.length === 0 ? (
                <p className="dd-muted">No bills on file.</p>
              ) : (
                clearedBills.map((b) => (
                  <div key={b.id} className="dd-bill-row">
                    <div>
                      <span>{b.visitType === 'IPD' ? 'IPD' : 'OPD'}</span>{' '}
                      <span className="dd-mono">{b.billNumber || b.id}</span>
                      <div className="dd-muted" style={{ marginTop: 4 }}>
                        Paid {money(b.paidAmount)} · Total {money(b.totalAmount)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dd-btn dd-btn-secondary"
                      disabled={printingBillId === b.id}
                      onClick={() => printBill(b.id)}
                    >
                      {printingBillId === b.id ? 'Opening…' : 'Print slip'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="dd-card" style={{ marginBottom: 20 }}>
          <div className="dd-card-head">
            <h2>Lab reports</h2>
          </div>
          <div className="dd-card-body">
            <div className="dd-lab-wrap">
              <PatientLabReportsPanel patientId={patientId} embedded title="Lab reports" />
            </div>
          </div>
        </section>

        <div className="dd-strip dd-strip--actions">
          <button
            type="button"
            className="dd-btn dd-btn-primary"
            onClick={() =>
              navigate(`/dashboard/reception/ipd/discharge/final/${encodeURIComponent(id)}`, {
                state: {
                  patient: {
                    id: admission.id,
                    name: p.name,
                    uhid: p.uhid,
                    ward: clearances.ward,
                    bed: clearances.bed,
                    doctor: clearances.doctor || admission.doctor?.user?.name || '',
                  },
                },
              })
            }
          >
            Process to Final Discharge →
          </button>

        </div>
      </div>
    </div>
  );
}
