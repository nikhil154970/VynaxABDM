const { prisma } = require('../../../config/prisma');

function parseOptionalInt(v) {
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function computeBillStatus(paid, total) {
  if (paid >= total) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'PENDING';
}

async function allocateNextBillNumber(tx, billDate) {
  const d = billDate || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const prefix = `BILL-${y}${m}${day}-`;
  const agg = await tx.bill.aggregate({
    where: { billNumber: { startsWith: prefix } },
    _max: { billNumber: true },
  });
  let next = 1;
  const maxStr = agg._max.billNumber;
  if (maxStr && String(maxStr).startsWith(prefix)) {
    const tail = String(maxStr).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  if (next > 9999) throw new Error('BILL_NUMBER_EXHAUSTED');
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function mapBillRow(bill) {
  if (!bill) return null;
  const totalAmount = bill.totalAmount || 0;
  const paidAmount = bill.paidAmount || 0;
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    status: bill.status,
    subtotalAmount: bill.subtotalAmount,
    discountAmount: bill.discountAmount,
    taxAmount: bill.taxAmount,
    totalAmount,
    paidAmount,
    pendingAmount: Math.max(0, totalAmount - paidAmount),
    lastPaymentMode: bill.lastPaymentMode,
    billDate: bill.billDate,
    notes: bill.notes,
    lineItems: (bill.lineItems || []).map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
    })),
    payments: (bill.payments || []).map((p) => ({
      id: p.id,
      amount: p.amount,
      mode: p.mode,
      note: p.note,
      createdAt: p.createdAt,
    })),
  };
}

async function notifyOtTechnicians(patient, { partialPayment = false, pendingAmount = 0 } = {}) {
  try {
    const otUsers = await prisma.user.findMany({
      where: { role: 'OT_TECHNICIAN', isActive: true },
      select: { id: true },
    });
    if (!otUsers.length) return;
    const name = patient?.name || 'Patient';
    const uhid = patient?.uhid || '';
    const paymentNote = partialPayment && pendingAmount > 0
      ? ` Advance received — ₹${pendingAmount} pending on OT bill.`
      : '';
    await prisma.notification.createMany({
      data: otUsers.map((u) => ({
        userId: u.id,
        type: 'UPDATE',
        severity: partialPayment && pendingAmount > 0 ? 'WARNING' : 'INFO',
        title: 'New OT Request',
        message: `Patient ${name} (${uhid}) approved for OT surgery.${paymentNote}`,
      })),
    });
  } catch (notifyErr) {
    console.warn('OT notification failed:', notifyErr?.message || notifyErr);
  }
}

async function listOtRequests(req, res) {
  try {
    const { status, page = 1, limit = 20, q } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const search = String(q || '').trim();

    const where = {};
    if (!status || ['OT_REQUEST_CREATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'].includes(status)) {
      where.preOperativeAssessment = { is: {} };
    }
    where.status = status || { in: ['OT_REQUEST_CREATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] };
    if (search) {
      where.AND = [
        {
          OR: [
            { uhid: { contains: search, mode: 'insensitive' } },
            { requestNumber: { contains: search, mode: 'insensitive' } },
            { surgeryRecommendation: { contains: search, mode: 'insensitive' } },
            { diagnosis: { contains: search, mode: 'insensitive' } },
            { patient: { name: { contains: search, mode: 'insensitive' } } },
            { nurse: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.otRequest.findMany({
        where,
        skip,
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, uhid: true } },
          doctor: { select: { id: true, user: { select: { name: true } } } },
          nurse: { select: { id: true, name: true } },
          admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
          bill: { include: { lineItems: true, payments: true } },
          preOperativeAssessment: { select: { id: true, createdAt: true } },
          statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
      prisma.otRequest.count({ where }),
    ]);

    return res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('receptionist listOtRequests error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getOtRequestDetail(req, res) {
  try {
    const { id } = req.params;
    const item = await prisma.otRequest.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        nurse: { select: { id: true, name: true } },
        admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
        bill: { include: { lineItems: true, payments: true } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!item) return res.status(404).json({ message: 'OT request not found' });
    return res.json({ otRequest: item });
  } catch (err) {
    console.error('getOtRequestDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function generateOtBill(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { otCharges, surgeonCharges, anaesthesiaCharges, equipmentCharges, miscellaneousCharges, discountAmount, taxAmount, notes, saveDraft } = req.body;

    const otRequest = await prisma.otRequest.findUnique({
      where: { id },
      include: { patient: { select: { id: true, name: true, uhid: true } } },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    if (otRequest.billId) return res.status(409).json({ message: 'Bill already generated for this OT request' });

    const items = [];
    if (parseOptionalInt(otCharges) > 0) items.push({ description: 'OT Charges', quantity: 1, unitPrice: parseOptionalInt(otCharges), lineTotal: parseOptionalInt(otCharges) });
    if (parseOptionalInt(surgeonCharges) > 0) items.push({ description: 'Surgeon Charges', quantity: 1, unitPrice: parseOptionalInt(surgeonCharges), lineTotal: parseOptionalInt(surgeonCharges) });
    if (parseOptionalInt(anaesthesiaCharges) > 0) items.push({ description: 'Anaesthesia Charges', quantity: 1, unitPrice: parseOptionalInt(anaesthesiaCharges), lineTotal: parseOptionalInt(anaesthesiaCharges) });
    if (parseOptionalInt(equipmentCharges) > 0) items.push({ description: 'Equipment Charges', quantity: 1, unitPrice: parseOptionalInt(equipmentCharges), lineTotal: parseOptionalInt(equipmentCharges) });
    if (parseOptionalInt(miscellaneousCharges) > 0) items.push({ description: 'Miscellaneous Charges', quantity: 1, unitPrice: parseOptionalInt(miscellaneousCharges), lineTotal: parseOptionalInt(miscellaneousCharges) });

    if (items.length === 0) return res.status(400).json({ message: 'At least one charge amount must be greater than 0' });

    const subtotalAmount = items.reduce((s, li) => s + li.lineTotal, 0);
    const disc = Math.max(0, Math.min(subtotalAmount, parseOptionalInt(discountAmount)));
    const tax = Math.max(0, parseOptionalInt(taxAmount));
    const totalAmount = subtotalAmount - disc + tax;

    const billDate = new Date();
    const isDraft = Boolean(saveDraft);

    const result = await prisma.$transaction(async (tx) => {
      const billNumber = isDraft ? `DRAFT-OT-${Date.now().toString(36).toUpperCase()}` : await allocateNextBillNumber(tx, billDate);

      const bill = await tx.bill.create({
        data: {
          billNumber,
          patientId: otRequest.patientId,
          visitType: 'IPD',
          status: isDraft ? 'DRAFT' : 'PENDING',
          subtotalAmount,
          discountAmount: disc,
          taxAmount: tax,
          totalAmount,
          paidAmount: 0,
          admissionId: otRequest.ipdId,
          notes: notes || null,
          billDate,
          lineItems: { create: items },
        },
        include: { lineItems: true, payments: true },
      });

      await tx.otRequest.update({
        where: { id: otRequest.id },
        data: {
          billId: bill.id,
          status: isDraft ? 'OT_REQUEST_CREATED' : 'PAYMENT_PENDING',
          billDate: isDraft ? null : billDate,
          statusHistory: {
            create: {
              status: isDraft ? 'OT_REQUEST_CREATED' : 'PAYMENT_PENDING',
              changedBy: userId,
            },
          },
        },
      });

      return bill;
    }, { maxWait: 15000, timeout: 30000 });

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId, action: 'CREATE_OT_REQUEST', module: 'OT' });
    } catch { /* best-effort */ }

    return res.status(201).json({
      ok: true,
      bill: mapBillRow(result),
      isDraft,
    });
  } catch (err) {
    console.error('generateOtBill error:', err);
    if (err.message === 'BILL_NUMBER_EXHAUSTED') return res.status(500).json({ message: 'Bill number exhausted for today' });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getOtBill(req, res) {
  try {
    const { id } = req.params;
    const otRequest = await prisma.otRequest.findUnique({
      where: { id },
      select: { billId: true },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    if (!otRequest.billId) return res.status(404).json({ message: 'No bill generated for this OT request' });

    const bill = await prisma.bill.findUnique({
      where: { id: otRequest.billId },
      include: { lineItems: true, payments: true, patient: { select: { name: true, uhid: true } } },
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    return res.json({ bill: mapBillRow(bill) });
  } catch (err) {
    console.error('getOtBill error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function payOtBill(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { amount, mode } = req.body;

    const payAmount = parseOptionalInt(amount);
    if (payAmount <= 0) return res.status(400).json({ message: 'Valid payment amount is required' });

    const otRequest = await prisma.otRequest.findUnique({
      where: { id },
      include: { bill: { include: { payments: { select: { amount: true } } } } },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    if (!otRequest.billId || !otRequest.bill) return res.status(400).json({ message: 'No bill found. Generate bill first.' });

    const bill = otRequest.bill;
    const payMode = String(mode || 'Cash').trim() || 'Cash';
    const paidRaw = Math.max(0, bill.paidAmount || 0);
    const paidByPayments = (bill.payments || []).reduce((s, p) => s + Math.max(0, p?.amount || 0), 0);
    const effectivePaid = Math.max(paidRaw, paidByPayments);
    const pending = Math.max(0, (bill.totalAmount || 0) - effectivePaid);
    const pay = Math.min(payAmount, pending);
    if (pay <= 0) return res.status(400).json({ message: 'No pending balance on this bill' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.billPayment.create({
        data: { billId: bill.id, amount: pay, mode: payMode, note: 'OT bill payment' },
      });

      const paidAmount = effectivePaid + pay;
      const billStatus = computeBillStatus(paidAmount, bill.totalAmount);

      const saved = await tx.bill.update({
        where: { id: bill.id },
        data: { paidAmount, status: billStatus, lastPaymentMode: payMode },
        include: { lineItems: true, payments: true, patient: { select: { name: true, uhid: true } } },
      });

      return saved;
    }, { maxWait: 15000, timeout: 30000 });

    const now = new Date();
    const isFullyPaid = updated.paidAmount >= updated.totalAmount;
    const downstream = ['RECEIVED_BY_OT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];
    if (!downstream.includes(String(otRequest.status || '').toUpperCase())) {
      await prisma.otRequest.update({
        where: { id: otRequest.id },
        data: {
          status: 'APPROVED_FOR_OT',
          billDate: now,
          statusHistory: {
            create: { status: 'APPROVED_FOR_OT', changedBy: userId },
          },
        },
      });
    }

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId, action: 'UPDATE_OT_REQUEST_STATUS', module: 'OT' });
    } catch { /* best-effort */ }

    const receiptId = `RCPT-${String(updated.billNumber || '').replace(/\D/g, '').slice(-8)}${Date.now().toString(36).slice(-4)}`;

    return res.json({
      ok: true,
      bill: mapBillRow(updated),
      receiptId,
      fullyPaid: isFullyPaid,
    });
  } catch (err) {
    console.error('payOtBill error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function approveForOt(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const otRequest = await prisma.otRequest.findUnique({
      where: { id },
      include: {
        bill: { select: { paidAmount: true, totalAmount: true, status: true } },
        patient: { select: { name: true, uhid: true } },
      },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    if (otRequest.status !== 'PAYMENT_COMPLETED') return res.status(400).json({ message: 'Payment must be completed before approval' });
    if (!otRequest.bill || otRequest.bill.paidAmount < otRequest.bill.totalAmount) {
      return res.status(400).json({ message: 'Bill must be fully paid before approval' });
    }

    const updated = await prisma.otRequest.update({
      where: { id },
      data: {
        status: 'APPROVED_FOR_OT',
        billDate: new Date(),
        statusHistory: {
          create: { status: 'APPROVED_FOR_OT', changedBy: userId },
        },
      },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        nurse: { select: { id: true, name: true } },
        bill: { include: { lineItems: true, payments: true } },
      },
    });

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId, action: 'UPDATE_OT_REQUEST_STATUS', module: 'OT' });
    } catch { /* best-effort */ }

    try {
      const otUsers = await prisma.user.findMany({
        where: { role: 'OT_TECHNICIAN', isActive: true },
        select: { id: true },
      });
      if (otUsers.length > 0) {
        await prisma.notification.createMany({
          data: otUsers.map((u) => ({
            userId: u.id,
            type: 'UPDATE',
            severity: 'INFO',
            title: 'New OT Patient Approved',
            message: `Patient ${otRequest.patient?.name} (${otRequest.patient?.uhid}) has been approved for OT surgery`,
          })),
        });
      }
    } catch (notifyErr) {
      console.warn('OT notification failed:', notifyErr?.message || notifyErr);
    }

    return res.json({ otRequest: updated, approved: true });
  } catch (err) {
    console.error('approveForOt error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function listApprovedForOt(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const where = {
      status: { in: ['APPROVED_FOR_OT', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] },
    };

    const [items, total] = await Promise.all([
      prisma.otRequest.findMany({
        where,
        skip,
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: { billDate: 'desc' },
        include: {
          patient: { select: { id: true, name: true, uhid: true, age: true, gender: true } },
          doctor: { select: { id: true, user: { select: { name: true } } } },
          nurse: { select: { id: true, name: true } },
          admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
          bill: { include: { payments: true } },
        },
      }),
      prisma.otRequest.count({ where }),
    ]);

    const legacyIds = items
      .filter((i) => i.billId && (i.status === 'PAYMENT_PENDING' || i.status === 'PAYMENT_COMPLETED'))
      .map((i) => i.id);
    if (legacyIds.length) {
      await prisma.otRequest.updateMany({
        where: { id: { in: legacyIds } },
        data: { status: 'APPROVED_FOR_OT' },
      });
      items.forEach((i) => {
        if (legacyIds.includes(i.id)) i.status = 'APPROVED_FOR_OT';
      });
    }

    return res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('listApprovedForOt error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function searchOtRequests(req, res) {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    const term = String(q).trim();

    const items = await prisma.otRequest.findMany({
      where: {
        status: 'OT_REQUEST_CREATED',
        billId: null,
        preOperativeAssessment: { isNot: null },
        OR: [
          { uhid: { contains: term, mode: 'insensitive' } },
          { requestNumber: { contains: term, mode: 'insensitive' } },
          { patient: { name: { contains: term, mode: 'insensitive' } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        nurse: { select: { id: true, name: true } },
        admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
      },
    });

    return res.json({ items });
  } catch (err) {
    console.error('searchOtRequests error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function generateAndApprove(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'OT request ID is required' });

    const body = req.body || {};
    const otCharges = parseOptionalInt(body.otCharges);
    const surgeonCharges = parseOptionalInt(body.surgeonCharges);
    const anaesthesiaCharges = parseOptionalInt(body.anaesthesiaCharges);
    const equipmentCharges = parseOptionalInt(body.equipmentCharges);
    const miscellaneousCharges = parseOptionalInt(body.miscellaneousCharges);
    const discountAmount = parseOptionalInt(body.discountAmount);
    const taxAmount = parseOptionalInt(body.taxAmount);
    const notes = body.notes || null;
    const initialPaid = Math.max(0, parseOptionalInt(body.initialPaid) || 0);
    const paymentMode = body.paymentMode || 'Cash';

    const otRequest = await prisma.otRequest.findUnique({
      where: { id },
      include: { patient: { select: { id: true, name: true, uhid: true } } },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    if (otRequest.status !== 'OT_REQUEST_CREATED') return res.status(400).json({ message: 'OT request must be in CREATED status to generate bill' });
    if (otRequest.billId) return res.status(409).json({ message: 'Bill already generated for this OT request' });

    const items = [];
    if (otCharges > 0) items.push({ description: 'OT Charges', quantity: 1, unitPrice: otCharges, lineTotal: otCharges });
    if (surgeonCharges > 0) items.push({ description: 'Surgeon Charges', quantity: 1, unitPrice: surgeonCharges, lineTotal: surgeonCharges });
    if (anaesthesiaCharges > 0) items.push({ description: 'Anaesthesia Charges', quantity: 1, unitPrice: anaesthesiaCharges, lineTotal: anaesthesiaCharges });
    if (equipmentCharges > 0) items.push({ description: 'Equipment Charges', quantity: 1, unitPrice: equipmentCharges, lineTotal: equipmentCharges });
    if (miscellaneousCharges > 0) items.push({ description: 'Miscellaneous Charges', quantity: 1, unitPrice: miscellaneousCharges, lineTotal: miscellaneousCharges });

    if (items.length === 0) return res.status(400).json({ message: 'At least one charge amount must be greater than 0' });

    const subtotalAmount = items.reduce((s, li) => s + li.lineTotal, 0);
    const disc = Math.max(0, Math.min(subtotalAmount, discountAmount));
    const tax = Math.max(0, taxAmount);
    const totalAmount = subtotalAmount - disc + tax;
    const billDate = new Date();
    const paid0 = Math.min(initialPaid, totalAmount);
    const billStatus = computeBillStatus(paid0, totalAmount);
    const isFullyPaid = paid0 >= totalAmount;

    const result = await prisma.$transaction(async (tx) => {
      const billNumber = await allocateNextBillNumber(tx, billDate);

      const bill = await tx.bill.create({
        data: {
          billNumber,
          patientId: otRequest.patientId,
          visitType: 'IPD',
          status: billStatus,
          subtotalAmount,
          discountAmount: disc,
          taxAmount: tax,
          totalAmount,
          paidAmount: paid0,
          lastPaymentMode: paid0 > 0 ? paymentMode : null,
          admissionId: otRequest.ipdId,
          notes,
          billDate,
          lineItems: { create: items },
          ...(paid0 > 0 ? { payments: { create: { amount: paid0, mode: paymentMode, note: paid0 >= totalAmount ? 'OT bill full payment' : 'OT bill advance payment' } } } : {}),
        },
        include: { lineItems: true, payments: true },
      });

      const otStatus = 'APPROVED_FOR_OT';

      await tx.otRequest.update({
        where: { id: otRequest.id },
        data: {
          billId: bill.id,
          status: otStatus,
          billDate,
          statusHistory: {
            create: { status: otStatus, changedBy: userId },
          },
        },
      });

      return { bill, isFullyPaid, pendingAmount: Math.max(0, totalAmount - paid0) };
    }, { maxWait: 15000, timeout: 30000 });

    const { pendingAmount } = result;

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId, action: 'UPDATE_OT_REQUEST_STATUS', module: 'OT' });
    } catch { /* best-effort */ }

    await notifyOtTechnicians(otRequest.patient, {
      partialPayment: !isFullyPaid,
      pendingAmount,
    });

    return res.status(201).json({
      ok: true,
      bill: mapBillRow(result.bill),
      approved: true,
      fullyPaid: isFullyPaid,
      pendingAmount,
    });
  } catch (err) {
    console.error('generateAndApprove error:', err?.message || err);
    console.error('generateAndApprove stack:', err?.stack);
    if (err?.message === 'BILL_NUMBER_EXHAUSTED') return res.status(500).json({ message: 'Bill number exhausted for today' });
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

module.exports = { listOtRequests, getOtRequestDetail, generateOtBill, getOtBill, payOtBill, approveForOt, listApprovedForOt, searchOtRequests, generateAndApprove };
