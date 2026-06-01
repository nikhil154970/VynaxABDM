import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CircleDollarSign,
  Clock3,
  FileEdit,
  ReceiptText,
  RotateCcw,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import Toast from '../../components/Toast';
import PatientSelector from '../../components/pharmacy/billing/PatientSelector';
import MedicineSearch from '../../components/pharmacy/billing/MedicineSearch';
import BillItemsTable from '../../components/pharmacy/billing/BillItemsTable';
import BillSummaryCard from '../../components/pharmacy/billing/BillSummaryCard';
import PaymentSection from '../../components/pharmacy/billing/PaymentSection';
import RecentBillsTable from '../../components/pharmacy/billing/RecentBillsTable';
import { calcBillTotals, money } from '../../lib/pharmacy/billingCalc';
import {
  createBill,
  fetchBillById,
  fetchBills,
  searchInventory,
  searchBillingPatients,
  updateBill,
} from '../../services/pharmacy/billingService';
import { printPharmacyBill } from '../../utils/printPharmacyBill';
import { markQueueBilled } from '../../services/pharmacy/queueService';

let lineSeq = 1;

function SummaryCard({ item }) {
  const Icon = item.icon;
  return (
    <div className={`group rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{item.label}</p>
          <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">{item.value}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{item.sub}</p>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('hospital');
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [walkIn, setWalkIn] = useState({ name: '', mobile: '' });
  const [lineItems, setLineItems] = useState([]);
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingBills, setLoadingBills] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null);
  const [editingBillNumber, setEditingBillNumber] = useState('');
  const [resumingDraft, setResumingDraft] = useState(false);
  const [sourceQueueId, setSourceQueueId] = useState(null);
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const totals = useMemo(() => calcBillTotals(lineItems), [lineItems]);

  const draftBills = useMemo(() => (bills || []).filter((b) => b.status === 'DRAFT'), [bills]);

  const summaryCards = useMemo(() => {
    const s = stats || {};
    return [
      {
        label: "Today's Billing",
        value: money(s.todayBilling),
        sub: `${s.todayBillCount || 0} invoices today`,
        icon: CircleDollarSign,
        tone: 'from-blue-50 to-cyan-50 text-blue-600 border-blue-100',
      },
      {
        label: 'Total Bills',
        value: String(s.totalBills ?? '—'),
        sub: 'All pharmacy bills',
        icon: ReceiptText,
        tone: 'from-violet-50 to-indigo-50 text-violet-600 border-violet-100',
      },
      {
        label: 'Pending Bills',
        value: String(s.pendingBills ?? '—'),
        sub: 'Awaiting payment',
        icon: Clock3,
        tone: 'from-amber-50 to-orange-50 text-orange-600 border-amber-100',
      },
      {
        label: 'Cancelled',
        value: String(s.returnedBills ?? '—'),
        sub: 'Returned / void',
        icon: RotateCcw,
        tone: 'from-rose-50 to-red-50 text-rose-600 border-rose-100',
      },
    ];
  }, [stats]);

  const loadBills = useCallback(async () => {
    setLoadingBills(true);
    try {
      const data = await fetchBills({ limit: 30 });
      setBills(data.bills || []);
      setStats(data.stats || null);
    } catch {
      setToast({ type: 'error', message: 'Failed to load recent bills' });
    } finally {
      setLoadingBills(false);
    }
  }, []);

  // Prefill billing from Pharmacy Queue (Create Bill action)
  useEffect(() => {
    const st = location.state || {};
    const pq = st.pharmacyQueue;
    if (!pq?.id) return;

    // avoid re-applying if user navigates inside same page
    setSourceQueueId(pq.id);
    setEditingBillId(null);
    setEditingBillNumber('');
    setPaymentOpen(false);

    const patient = st.prefillPatient || {};
    const doctor = st.prefillDoctor || {};
    const rxItems = Array.isArray(st.prefillPrescription) ? st.prefillPrescription : [];

    setActiveTab('hospital');
    setSelectedPatient({
      patientId: patient.id,
      patientName: patient.name || '',
      uhid: patient.uhid || '',
      mobile: patient.mobile || '',
      tokenNumber: pq.tokenNumber || '',
      doctorName: doctor.name || '',
      department: doctor.department || '',
      visitDate: null,
      receptionVisitId: null,
    });
    setHospitalSearch(patient.name || patient.uhid || '');

    // Resolve medicines from inventory FEFO batches
    (async () => {
      try {
        const resolved = [];
        for (const row of rxItems) {
          const name = String(row?.medicineName || '').trim();
          if (!name) continue;
          const data = await searchInventory({ q: name });
          const meds = Array.isArray(data?.medicines) ? data.medicines : [];
          const med = meds[0];
          const batch = med?.defaultBatch || med?.batches?.[0];
          if (!med?.medicineId || !batch?.inventoryBatchId) continue;
          resolved.push({
            medicineId: med.medicineId,
            inventoryBatchId: batch.inventoryBatchId,
            medicineName: med.medicineName,
            genericName: med.genericName,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            availableQty: batch.availableQty,
            quantity: Math.max(1, Number(row.quantity || 1)),
            mrp: batch.mrp,
            sellingPrice: batch.sellingPrice,
            discountPercent: 0,
            gstPercentage: batch.gstPercentage,
            batches: med.batches,
          });
        }

        setLineItems(
          resolved.map((r) => ({
            ...r,
            lineId: `line-${lineSeq++}`,
            quantity: Math.min(r.availableQty, r.quantity),
          }))
        );
        setToast({ type: 'success', message: `Loaded ${resolved.length} items from Prescription Queue` });
      } catch {
        setToast({ type: 'error', message: 'Failed to prefill from prescription queue' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  useEffect(() => {
    if (activeTab !== 'hospital' || hospitalSearch.length < 2) {
      setPatientResults([]);
      return undefined;
    }
    let active = true;
    const t = setTimeout(() => {
      searchBillingPatients(hospitalSearch)
        .then((data) => {
          if (active) setPatientResults(data.patients || []);
        })
        .catch(() => {
          if (active) setPatientResults([]);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [hospitalSearch, activeTab]);

  const handleAddLine = (row) => {
    setLineItems((prev) => {
      const existing = prev.find((p) => p.inventoryBatchId === row.inventoryBatchId);
      if (existing) {
        return prev.map((p) =>
          p.inventoryBatchId === row.inventoryBatchId
            ? { ...p, quantity: Math.min(p.availableQty, p.quantity + 1) }
            : p
        );
      }
      return [...prev, { ...row, lineId: `line-${lineSeq++}` }];
    });
  };

  const handleUpdateItem = (lineId, patch) => {
    setLineItems((prev) => prev.map((item) => (item.lineId === lineId ? { ...item, ...patch } : item)));
  };

  const handleChangeBatch = (lineId, batchId) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.lineId !== lineId) return item;
        const batch = (item.batches || []).find((b) => b.inventoryBatchId === batchId);
        if (!batch) return item;
        return {
          ...item,
          inventoryBatchId: batch.inventoryBatchId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          availableQty: batch.availableQty,
          mrp: batch.mrp,
          sellingPrice: batch.sellingPrice,
          gstPercentage: batch.gstPercentage,
          quantity: Math.min(item.quantity, batch.availableQty),
        };
      })
    );
  };

  const resetBillingForm = () => {
    setEditingBillId(null);
    setEditingBillNumber('');
    setLineItems([]);
    setSelectedPatient(null);
    setWalkIn({ name: '', mobile: '' });
    setHospitalSearch('');
    setPatientResults([]);
    setPaymentOpen(false);
    setSourceQueueId(null);
  };

  const handleResumeDraft = async (billId) => {
    if (editingBillId === billId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setResumingDraft(true);
    try {
      const data = await fetchBillById(billId, { forEdit: true });
      const bill = data.bill;
      if (!bill || bill.status !== 'DRAFT') {
        setToast({ type: 'error', message: 'Only draft bills can be resumed' });
        return;
      }

      setActiveTab(bill.billingType === 'WALK_IN' ? 'walkin' : 'hospital');

      if (bill.billingType === 'WALK_IN') {
        setWalkIn({
          name: bill.customerName || bill.patientName || '',
          mobile: bill.customerMobile || '',
        });
        setSelectedPatient(null);
        setHospitalSearch('');
      } else {
        setSelectedPatient({
          patientId: bill.patientId,
          patientName: bill.patientName,
          uhid: bill.patientUhid,
          mobile: bill.customerMobile,
          tokenNumber: bill.tokenNumber,
          doctorName: bill.doctorName,
          department: bill.department,
          visitDate: bill.visitDate,
          receptionVisitId: bill.receptionVisitId,
        });
        setHospitalSearch(bill.patientName || '');
        setWalkIn({ name: '', mobile: '' });
      }

      setLineItems(
        (bill.items || []).map((item) => ({
          lineId: `line-${lineSeq++}`,
          medicineId: item.medicineId,
          inventoryBatchId: item.inventoryBatchId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          mrp: item.mrp,
          sellingPrice: item.sellingPrice,
          discountPercent: item.discountPercent ?? 0,
          gstPercentage: item.gstPercentage,
          availableQty: item.availableQty ?? 0,
          batches: item.batches || [],
        }))
      );

      setEditingBillId(bill.id);
      setEditingBillNumber(bill.billNumber);
      setToast({ type: 'success', message: `Draft ${bill.billNumber} loaded — continue billing` });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load draft bill',
      });
    } finally {
      setResumingDraft(false);
    }
  };

  const buildPayload = (extra = {}) => {
    const items = lineItems.map((item) => ({
      medicineId: item.medicineId,
      inventoryBatchId: item.inventoryBatchId,
      quantity: item.quantity,
      mrp: item.mrp,
      sellingPrice: item.sellingPrice,
      discountPercent: item.discountPercent,
      gstPercentage: item.gstPercentage,
    }));

    if (activeTab === 'hospital') {
      return {
        billingType: 'HOSPITAL_PATIENT',
        patientId: selectedPatient?.patientId,
        tokenNumber: selectedPatient?.tokenNumber,
        doctorName: selectedPatient?.doctorName,
        department: selectedPatient?.department,
        visitDate: selectedPatient?.visitDate,
        receptionVisitId: selectedPatient?.receptionVisitId,
        customerMobile: selectedPatient?.mobile,
        items,
        ...extra,
      };
    }
    return {
      billingType: 'WALK_IN',
      customerName: walkIn.name,
      customerMobile: walkIn.mobile,
      items,
      ...extra,
    };
  };

  const validateBeforeSubmit = () => {
    if (!lineItems.length) {
      setToast({ type: 'error', message: 'Add at least one medicine from inventory' });
      return false;
    }
    if (activeTab === 'hospital' && !selectedPatient?.patientId) {
      setToast({ type: 'error', message: 'Select a hospital patient' });
      return false;
    }
    if (activeTab === 'walkin' && !walkIn.name.trim()) {
      setToast({ type: 'error', message: 'Enter walk-in customer name' });
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateBeforeSubmit()) return;
    setSubmitting(true);
    try {
      if (editingBillId) {
        await updateBill(editingBillId, buildPayload({ saveAsDraft: true }));
        setToast({ type: 'success', message: `Draft ${editingBillNumber} updated` });
      } else {
        const data = await createBill(buildPayload({ saveAsDraft: true }));
        setEditingBillId(data.bill?.id || null);
        setEditingBillNumber(data.bill?.billNumber || '');
        setToast({
          type: 'success',
          message: data.bill?.billNumber
            ? `Draft ${data.bill.billNumber} saved`
            : 'Bill saved as draft',
        });
      }
      loadBills();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save draft',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async ({ paymentMode, paidAmount }) => {
    if (!validateBeforeSubmit()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload({
        saveAsDraft: false,
        paymentMode,
        paidAmount,
      });
      const data = editingBillId
        ? await updateBill(editingBillId, payload)
        : await createBill(payload);
      const queueIdToClose = sourceQueueId;
      resetBillingForm();
      setToast({
        type: 'success',
        message:
          activeTab === 'walkin'
            ? `Bill ${data.bill?.billNumber} paid — auto dispensed`
            : `Bill ${data.bill?.billNumber} created — sent to dispensing queue`,
      });
      loadBills();
      if (data.bill?.id) printPharmacyBill(data.bill.id);

      // If this bill came from Prescription Queue, mark it BILLED.
      if (queueIdToClose && data.bill?.id) {
        markQueueBilled(queueIdToClose, { billId: data.bill.id }).catch(() => {});
      }
    } catch (err) {
      const errs = err.response?.data?.errors;
      setToast({
        type: 'error',
        message:
          errs?.[0]?.message || err.response?.data?.message || 'Failed to complete billing',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3 text-slate-800 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, message: '' })} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((item) => (
          <SummaryCard key={item.label} item={item} />
        ))}
      </div>

      {editingBillId ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-900">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 shrink-0 text-violet-600" />
            <span>
              Editing draft <strong>{editingBillNumber}</strong> — add medicines, then save or pay.
            </span>
          </div>
          <button
            type="button"
            onClick={resetBillingForm}
            disabled={submitting || resumingDraft}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            New Bill
          </button>
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'hospital', label: 'Hospital Patient Billing', hint: 'Prescription / OPD linked' },
            { id: 'walkin', label: 'Walk-in Customer Billing', hint: 'Pay & auto dispense' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2 text-left transition ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className={`block text-[11px] ${activeTab === tab.id ? 'text-blue-100' : 'text-slate-400'}`}>
                {tab.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-3">
            <h2 className="text-sm font-semibold text-slate-900">Add Medicines</h2>
            <p className="text-xs text-slate-500">FEFO batch selected automatically </p>
            <div className="mt-3">
              <MedicineSearch onAddLine={handleAddLine} disabled={submitting || resumingDraft} />
            </div>
          </div>
          <BillItemsTable
            items={lineItems}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={(lineId) => setLineItems((p) => p.filter((i) => i.lineId !== lineId))}
            onChangeBatch={handleChangeBatch}
          />
        </section>

        <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <UserRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {activeTab === 'hospital' ? 'Patient Info' : 'Customer Info'}
                </h2>
                <p className="text-xs text-slate-500">
                  {activeTab === 'hospital' ? 'Search by UHID, name, mobile' : 'Walk-in retail'}
                </p>
              </div>
            </div>
            <PatientSelector
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hospitalSearch={hospitalSearch}
              onHospitalSearchChange={setHospitalSearch}
              patientResults={patientResults}
              onSelectPatient={(p) => {
                setSelectedPatient(p);
                setPatientResults([]);
                setHospitalSearch(p.patientName);
              }}
              selectedPatient={selectedPatient}
              walkIn={walkIn}
              onWalkInChange={setWalkIn}
            />
          </section>

          <BillSummaryCard totals={totals}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting || resumingDraft}
                onClick={handleSaveDraft}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {editingBillId ? 'Update Draft' : 'Save Draft'}
              </button>
              <button
                type="button"
                disabled={submitting || resumingDraft}
                onClick={() => setPaymentOpen(true)}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                <WalletCards className="h-4 w-4" />
                Proceed To Payment
              </button>
            </div>
          </BillSummaryCard>
        </aside>
      </div>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3 py-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Recent Bills</h2>
          <p className="text-xs text-slate-500">
            Draft bills — use <strong>Resume</strong> to continue billing.
          </p>
        </div>
        <RecentBillsTable
          bills={draftBills}
          loading={loadingBills || resumingDraft}
          onPrint={printPharmacyBill}
          onResume={handleResumeDraft}
          editingBillId={editingBillId}
        />
      </section>

      <PaymentSection
        open={paymentOpen}
        grandTotal={totals.grandTotal}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handleConfirmPayment}
        loading={submitting}
      />
    </div>
  );
}
