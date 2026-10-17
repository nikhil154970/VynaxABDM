const { prisma } = require('../../config/prisma');
const { getHospitalPrintMeta } = require('../../lib/hospitalBranding');
const {
  PRISMA_TX,
  BILL_INCLUDE,
  normalizeString,
  parseNumber,
  roundMoney,
  calcLineAmount,
  calcBillTotals,
  derivePaymentStatus,
  mapBill,
  isUuid,
} = require('../../lib/pharmacy/billingHelpers');
const { computeDueDate } = require('../../lib/pharmacy/pendingDuesHelpers');
const { restoreStockFromBill, stockWasDeducted } = require('../../lib/pharmacy/billingStockHelpers');

async function generateBillNumber() {
  const last = await prisma.pharmacyBill.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { billNumber: true },
  });
  let next = 1;
  if (last?.billNumber) {
    const m = String(last.billNumber).match(/PH-BILL-(\d+)/i);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `PH-BILL-${String(next).padStart(4, '0')}`;
}

async function resolveBillItems(rawItems) {
  const errors = [];
  if (!Array.isArray(rawItems) || !rawItems.length) {
    return { errors: [{ field: 'items', message: 'At least one medicine line is required' }] };
  }

  const resolved = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const row = rawItems[i] || {};
    const medicineId = normalizeString(row.medicineId);
    const inventoryBatchId = normalizeString(row.inventoryBatchId);
    const quantity = parseNumber(row.quantity, NaN);

    if (!medicineId || !isUuid(medicineId)) {
      errors.push({ field: `items[${i}].medicineId`, message: 'Valid medicine is required' });
      continue;
    }
    if (!inventoryBatchId || !isUuid(inventoryBatchId)) {
      errors.push({ field: `items[${i}].inventoryBatchId`, message: 'Valid batch is required' });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push({ field: `items[${i}].quantity`, message: 'Quantity must be at least 1' });
      continue;
    }

    const batch = await prisma.pharmacyInventoryBatch.findUnique({
      where: { id: inventoryBatchId },
      include: { medicine: { select: { id: true, medicineName: true, genericName: true, status: true } } },
    });
    if (!batch) {
      errors.push({ field: `items[${i}].inventoryBatchId`, message: 'Batch not found in inventory' });
      continue;
    }
    if (batch.medicineId !== medicineId) {
      errors.push({ field: `items[${i}].inventoryBatchId`, message: 'Batch does not match medicine' });
      continue;
    }
    if (batch.status !== 'ACTIVE' || batch.availableQty <= 0) {
      errors.push({ field: `items[${i}].inventoryBatchId`, message: 'Batch is not available' });
      continue;
    }
    if (batch.availableQty < quantity) {
      errors.push({
        field: `items[${i}].quantity`,
        message: `Only ${batch.availableQty} units available in batch ${batch.batchNumber}`,
      });
      continue;
    }

    const sellingPrice = parseNumber(row.sellingPrice, Number(batch.sellingPrice));
    const mrp = parseNumber(row.mrp, Number(batch.mrp));
    const discountPercent = parseNumber(row.discountPercent, 0);
    const { amount } = calcLineAmount(quantity, sellingPrice, discountPercent, batch.gstPercentage);

    resolved.push({
      medicineId: batch.medicineId,
      inventoryBatchId: batch.id,
      medicineName: batch.medicineName,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantity,
      mrp,
      sellingPrice,
      discountPercent,
      gstPercentage: batch.gstPercentage,
      amount,
    });
  }

  if (errors.length) return { errors };
  return { items: resolved };
}

async function applyStockDeduction(tx, bill, items) {
  for (const item of items) {
    const batch = await tx.pharmacyInventoryBatch.findUnique({
      where: { id: item.inventoryBatchId },
      select: { id: true, availableQty: true, medicineId: true },
    });
    if (!batch || batch.availableQty < item.quantity) {
      throw new Error(`Insufficient stock for batch ${item.batchNumber}`);
    }
    const newBalance = batch.availableQty - item.quantity;
    await tx.pharmacyInventoryBatch.update({
      where: { id: batch.id },
      data: {
        availableQty: newBalance,
        status: newBalance <= 0 ? 'DEPLETED' : 'ACTIVE',
      },
    });
    await tx.pharmacyStockTransaction.create({
      data: {
        medicineId: item.medicineId,
        batchId: batch.id,
        type: 'BILLING',
        qtyIn: 0,
        qtyOut: item.quantity,
        balance: newBalance,
        referenceType: 'PHARMACY_BILL',
        referenceId: bill.id,
        notes: `Bill ${bill.billNumber} — batch ${item.batchNumber}`,
      },
    });
  }
}

const searchInventory = async (req, res) => {
  try {
    const q = normalizeString(req.query.q || req.query.search);
    const barcode = normalizeString(req.query.barcode);
    const where = { status: 'ACTIVE', availableQty: { gt: 0 } };

    if (barcode) {
      const med = await prisma.pharmacyMedicine.findFirst({
        where: { barcode, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!med) return res.json({ medicines: [] });
      where.medicineId = med.id;
    } else if (q) {
      where.OR = [
        { medicineName: { contains: q, mode: 'insensitive' } },
        { batchNumber: { contains: q, mode: 'insensitive' } },
        { medicine: { genericName: { contains: q, mode: 'insensitive' } } },
      ];
    } else if (req.query.listAll === '1' || req.query.all === '1') {
      // Reception: list all in-stock medicines (no search term).
    } else {
      return res.json({ medicines: [] });
    }

    const listAll = req.query.listAll === '1' || req.query.all === '1';
    const batches = await prisma.pharmacyInventoryBatch.findMany({
      where,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        medicine: {
          select: {
            id: true,
            medicineName: true,
            genericName: true,
            brandName: true,
            barcode: true,
            dosageForm: true,
          },
        },
      },
      take: listAll ? 500 : 80,
    });

    const byMedicine = new Map();
    batches.forEach((b) => {
      const key = b.medicineId;
      if (!byMedicine.has(key)) {
        byMedicine.set(key, {
          medicineId: b.medicineId,
          medicineName: b.medicineName,
          genericName: b.medicine?.genericName || '',
          brandName: b.medicine?.brandName || '',
          barcode: b.medicine?.barcode || '',
          dosageForm: b.medicine?.dosageForm || '',
          totalAvailable: 0,
          defaultBatch: null,
          batches: [],
        });
      }
      const entry = byMedicine.get(key);
      const batchRow = {
        inventoryBatchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        availableQty: b.availableQty,
        mrp: Number(b.mrp),
        sellingPrice: Number(b.sellingPrice),
        purchasePrice: Number(b.purchasePrice),
        gstPercentage: b.gstPercentage,
        isFefo: false,
      };
      entry.batches.push(batchRow);
      entry.totalAvailable += b.availableQty;
    });

    const medicines = [...byMedicine.values()].map((m) => {
      m.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      if (m.batches[0]) {
        m.batches[0].isFefo = true;
        m.defaultBatch = m.batches[0];
      }
      return m;
    });

    medicines.sort((a, b) => a.medicineName.localeCompare(b.medicineName));
    return res.json({ medicines: medicines.slice(0, 25) });
  } catch (err) {
    console.error('[pharmacy/billing] inventory-search', err);
    return res.status(500).json({ message: 'Failed to search inventory' });
  }
};

const searchPatients = async (req, res) => {
  try {
    const q = normalizeString(req.query.q || req.query.search);
    if (!q || q.length < 2) return res.json({ patients: [] });

    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { uhid: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q } },
        ],
      },
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true },
    });

    const enriched = await Promise.all(
      patients.map(async (p) => {
        const [visit, appt] = await Promise.all([
          prisma.receptionVisit.findFirst({
            where: { patientId: p.id },
            orderBy: { visitDate: 'desc' },
            select: {
              id: true,
              token: true,
              queueNumber: true,
              doctorName: true,
              department: true,
              visitDate: true,
            },
          }),
          prisma.appointment.findFirst({
            where: { patientId: p.id },
            orderBy: { date: 'desc' },
            select: {
              id: true,
              token: true,
              department: true,
              date: true,
              doctor: { select: { user: { select: { name: true } } } },
            },
          }),
        ]);

        const tokenNumber =
          visit?.token ||
          (visit?.queueNumber != null ? String(visit.queueNumber) : '') ||
          appt?.token ||
          '';

        return {
          patientId: p.id,
          patientName: p.name,
          uhid: p.uhid || '',
          mobile: p.mobile || '',
          age: p.age,
          gender: p.gender,
          tokenNumber,
          doctorName: visit?.doctorName || appt?.doctor?.user?.name || '',
          department: visit?.department || appt?.department || '',
          visitDate: visit?.visitDate || appt?.date || null,
          receptionVisitId: visit?.id || null,
        };
      })
    );

    return res.json({ patients: enriched });
  } catch (err) {
    console.error('[pharmacy/billing] patient-search', err);
    return res.status(500).json({ message: 'Failed to search patients' });
  }
};

const getBillingStats = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [todayAgg, totalCount, pendingCount, cancelledCount] = await Promise.all([
      prisma.pharmacyBill.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
          NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
        },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.pharmacyBill.count({
        where: {
          NOT: [
            { status: 'CANCELLED' },
            { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.pharmacyBill.count({
        where: {
          status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] },
          NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
        },
      }),
      prisma.pharmacyBill.count({
        where: {
          status: 'CANCELLED',
          NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
        },
      }),
    ]);

    return res.json({
      stats: {
        todayBilling: Number(todayAgg._sum.grandTotal ?? 0),
        todayBillCount: todayAgg._count,
        totalBills: totalCount,
        pendingBills: pendingCount,
        returnedBills: cancelledCount,
      },
    });
  } catch (err) {
    console.error('[pharmacy/billing] stats', err);
    return res.status(500).json({ message: 'Failed to load billing stats' });
  }
};

const getBills = async (req, res) => {
  try {
    const where = {
      OR: [
        { status: 'DRAFT' },
        { NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } } },
      ],
    };
    const status = normalizeString(req.query.status);
    if (status && status !== 'all') {
      const map = {
        Draft: 'DRAFT',
        'Pending Payment': 'PENDING_PAYMENT',
        'Partially Paid': 'PARTIALLY_PAID',
        Paid: 'PAID',
        Cancelled: 'CANCELLED',
      };
      where.status = map[status] || status.toUpperCase().replace(/\s+/g, '_');
    }
    const search = normalizeString(req.query.search || req.query.q);
    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: 'insensitive' } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { patientUhid: { contains: search, mode: 'insensitive' } },
      ];
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [bills, todayAgg, totalCount, pendingCount, cancelledCount] = await Promise.all([
      prisma.pharmacyBill.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, parseInt(req.query.limit, 10) || 50),
        include: BILL_INCLUDE,
      }),
      prisma.pharmacyBill.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
          NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
        },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.pharmacyBill.count({
        where: {
          NOT: [
            { status: 'CANCELLED' },
            { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.pharmacyBill.count({
        where: {
          status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] },
          NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
        },
      }),
      prisma.pharmacyBill.count({
        where: {
          status: 'CANCELLED',
          NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
        },
      }),
    ]);

    return res.json({
      bills: bills.map(mapBill),
      stats: {
        todayBilling: Number(todayAgg._sum.grandTotal ?? 0),
        todayBillCount: todayAgg._count,
        totalBills: totalCount,
        pendingBills: pendingCount,
        returnedBills: cancelledCount,
      },
    });
  } catch (err) {
    console.error('[pharmacy/billing] list', err);
    return res.status(500).json({ message: 'Failed to fetch bills' });
  }
};

async function enrichBillForResume(bill) {
  const mapped = mapBill(bill);
  const medicineIds = [...new Set(mapped.items.map((i) => i.medicineId))];
  if (!medicineIds.length) return mapped;

  const batches = await prisma.pharmacyInventoryBatch.findMany({
    where: {
      medicineId: { in: medicineIds },
      status: 'ACTIVE',
      availableQty: { gt: 0 },
    },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
  });

  const batchesByMedicine = new Map();
  medicineIds.forEach((id) => batchesByMedicine.set(id, []));
  batches.forEach((b) => {
    const list = batchesByMedicine.get(b.medicineId) || [];
    list.push({
      inventoryBatchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      availableQty: b.availableQty,
      mrp: Number(b.mrp),
      sellingPrice: Number(b.sellingPrice),
      gstPercentage: b.gstPercentage,
      isFefo: list.length === 0,
    });
    batchesByMedicine.set(b.medicineId, list);
  });

  mapped.items = mapped.items.map((item) => {
    const medBatches = batchesByMedicine.get(item.medicineId) || [];
    const current =
      medBatches.find((b) => b.inventoryBatchId === item.inventoryBatchId) ||
      medBatches[0] ||
      null;
    return {
      ...item,
      availableQty: current?.availableQty ?? 0,
      batches: medBatches,
    };
  });

  return mapped;
}

const getBillById = async (req, res) => {
  try {
    const bill = await prisma.pharmacyBill.findUnique({
      where: { id: req.params.id },
      include: BILL_INCLUDE,
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    const forEdit = req.query.forEdit === '1' || req.query.forEdit === 'true';
    const payload = forEdit && bill.status === 'DRAFT' ? await enrichBillForResume(bill) : mapBill(bill);
    return res.json({ bill: payload });
  } catch (err) {
    console.error('[pharmacy/billing] get', err);
    return res.status(500).json({ message: 'Failed to fetch bill' });
  }
};

const getPatientDues = async (req, res) => {
  try {
    const patientId = req.params.patientId;
    if (!isUuid(patientId)) return res.status(400).json({ message: 'Invalid patient id' });

    const bills = await prisma.pharmacyBill.findMany({
      where: {
        patientId,
        billingType: 'HOSPITAL_PATIENT',
        status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        billNumber: true,
        grandTotal: true,
        paidAmount: true,
        pendingAmount: true,
        status: true,
        createdAt: true,
      },
    });

    const totalAmount = bills.reduce((s, b) => s + Number(b.grandTotal), 0);
    const paidAmount = bills.reduce((s, b) => s + Number(b.paidAmount), 0);
    const pendingAmount = bills.reduce((s, b) => s + Number(b.pendingAmount), 0);

    return res.json({
      patientId,
      pharmacyDue: {
        totalAmount: roundMoney(totalAmount),
        paidAmount: roundMoney(paidAmount),
        pendingAmount: roundMoney(pendingAmount),
        bills,
      },
    });
  } catch (err) {
    console.error('[pharmacy/billing] patient-dues', err);
    return res.status(500).json({ message: 'Failed to fetch pharmacy dues' });
  }
};

const createBill = async (req, res) => {
  try {
    const body = req.body || {};
    const billingType = normalizeString(body.billingType).toUpperCase() === 'WALK_IN' ? 'WALK_IN' : 'HOSPITAL_PATIENT';
    const saveAsDraft = body.saveAsDraft === true || body.action === 'draft';

    const itemResult = await resolveBillItems(body.items);
    if (itemResult.errors) {
      return res.status(400).json({ message: 'Validation error', errors: itemResult.errors });
    }

    const totals = calcBillTotals(itemResult.items);
    const paidAmount = saveAsDraft ? 0 : roundMoney(parseNumber(body.paidAmount, 0));
    const grandTotal = totals.grandTotal;
    const pendingAmount = saveAsDraft ? grandTotal : roundMoney(Math.max(0, grandTotal - paidAmount));

    let patientSnapshot = {};
    if (billingType === 'HOSPITAL_PATIENT') {
      const patientId = normalizeString(body.patientId);
      if (!patientId || !isUuid(patientId)) {
        return res.status(400).json({ message: 'Hospital patient is required' });
      }
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) return res.status(404).json({ message: 'Patient not found' });

      // Prefer an explicit admission (e.g. carried from the nurse IPD medicine request /
      // pharmacy queue), otherwise fall back to any currently-open admission for the patient.
      const explicitAdmissionId =
        body.admissionId && isUuid(String(body.admissionId)) ? String(body.admissionId) : null;
      const activeAdmission = await prisma.admission.findFirst({
        where: {
          patientId: patient.id,
          ...(explicitAdmissionId
            ? { id: explicitAdmissionId }
            : { status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] } }),
        },
        orderBy: { admissionDate: 'desc' },
      });

      let tokenNumber = normalizeString(body.tokenNumber);
      if (activeAdmission && !/^IPD/i.test(tokenNumber)) {
        tokenNumber = `IPD-${tokenNumber}`.replace(/-$/, '');
      }

      patientSnapshot = {
        patientId: patient.id,
        // Save every billed medicine against the patient's IPD admission so reception can
        // fetch all pharmacy charges for that admission directly.
        admissionId: activeAdmission ? activeAdmission.id : null,
        patientName: patient.name,
        patientUhid: patient.uhid || '',
        customerMobile: patient.mobile || normalizeString(body.customerMobile),
        tokenNumber,
        doctorName: normalizeString(body.doctorName),
        department: normalizeString(body.department),
        visitDate: body.visitDate ? new Date(body.visitDate) : null,
        receptionVisitId: body.receptionVisitId && isUuid(body.receptionVisitId) ? body.receptionVisitId : null,
      };
    } else {
      const customerName = normalizeString(body.customerName);
      if (!customerName) {
        return res.status(400).json({ message: 'Customer name is required for walk-in billing' });
      }
      patientSnapshot = {
        customerName,
        customerMobile: normalizeString(body.customerMobile),
        patientName: customerName,
      };
    }

    const paymentModeRaw = normalizeString(body.paymentMode).toUpperCase();
    const paymentMode = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'MIXED'].includes(paymentModeRaw) ? paymentModeRaw : null;

    const status = derivePaymentStatus(grandTotal, paidAmount, saveAsDraft);
    const dispenseStatus =
      !saveAsDraft && billingType === 'WALK_IN' && status === 'PAID' ? 'DISPENSED' : 'PENDING';

    const billNumber = await generateBillNumber();
    const dueDate = !saveAsDraft && pendingAmount > 0 ? computeDueDate() : null;

    const bill = await prisma.$transaction(
      async (tx) => {
        const created = await tx.pharmacyBill.create({
          data: {
            billNumber,
            billingType,
            ...patientSnapshot,
            subTotal: totals.subTotal,
            discount: totals.discount,
            gstAmount: totals.gstAmount,
            grandTotal,
            paidAmount,
            pendingAmount,
            paymentMode: saveAsDraft ? null : paymentMode,
            status,
            dueDate,
            dispenseStatus,
            remarks: normalizeString(body.remarks) || null,
            createdBy: req.user?.userId || null,
            items: {
              create: itemResult.items.map((row) => ({
                medicineId: row.medicineId,
                inventoryBatchId: row.inventoryBatchId,
                medicineName: row.medicineName,
                batchNumber: row.batchNumber,
                expiryDate: row.expiryDate,
                quantity: row.quantity,
                mrp: row.mrp,
                sellingPrice: row.sellingPrice,
                discountPercent: row.discountPercent,
                gstPercentage: row.gstPercentage,
                amount: row.amount,
              })),
            },
          },
          include: BILL_INCLUDE,
        });

        if (!saveAsDraft) {
          await applyStockDeduction(tx, created, itemResult.items);
        }
        return created;
      },
      PRISMA_TX
    );

    return res.status(201).json({
      message: saveAsDraft ? 'Bill saved as draft' : 'Bill created successfully',
      bill: mapBill(bill),
    });
  } catch (err) {
    console.error('[pharmacy/billing] create', err);
    return res.status(500).json({ message: err?.message || 'Failed to create bill' });
  }
};

const updateBill = async (req, res) => {
  try {
    const existing = await prisma.pharmacyBill.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ message: 'Bill not found' });
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Cancelled bill cannot be updated' });
    }
    if (existing.status === 'PAID') {
      return res.status(400).json({ message: 'Paid bill cannot be edited' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ message: 'Only draft bills can be edited' });
    }

    const body = req.body || {};
    const itemResult = body.items ? await resolveBillItems(body.items) : { items: null };
    if (itemResult.errors) {
      return res.status(400).json({ message: 'Validation error', errors: itemResult.errors });
    }

    const items = itemResult.items || existing.items.map((i) => ({
      medicineId: i.medicineId,
      inventoryBatchId: i.inventoryBatchId,
      medicineName: i.medicineName,
      batchNumber: i.batchNumber,
      expiryDate: i.expiryDate,
      quantity: i.quantity,
      mrp: Number(i.mrp),
      sellingPrice: Number(i.sellingPrice),
      discountPercent: Number(i.discountPercent),
      gstPercentage: i.gstPercentage,
      amount: Number(i.amount),
    }));

    const totals = calcBillTotals(items);
    const saveAsDraft = body.saveAsDraft === true;
    const paidAmount =
      body.paidAmount !== undefined ? roundMoney(parseNumber(body.paidAmount, 0)) : Number(existing.paidAmount);
    const grandTotal = totals.grandTotal;
    const pendingAmount = roundMoney(Math.max(0, grandTotal - paidAmount));
    const status = derivePaymentStatus(grandTotal, paidAmount, saveAsDraft);
    const paymentModeRaw = normalizeString(body.paymentMode || existing.paymentMode).toUpperCase();
    const paymentMode = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'MIXED'].includes(paymentModeRaw) ? paymentModeRaw : null;

    const wasDeducted = stockWasDeducted(existing.status);
    const shouldDeduct = !saveAsDraft && !wasDeducted && status !== 'DRAFT';
    const dueDate = !saveAsDraft && pendingAmount > 0 ? existing.dueDate || computeDueDate() : null;

    const bill = await prisma.$transaction(
      async (tx) => {
        if (wasDeducted && itemResult.items) {
          throw new Error('Cannot change items after stock has been deducted. Cancel and create a new bill.');
        }

        if (itemResult.items) {
          await tx.pharmacyBillItem.deleteMany({ where: { billId: existing.id } });
        }

        let tokenNumber = existing.tokenNumber;
        if (existing.patientId) {
          const activeAdmission = await tx.admission.findFirst({
            where: {
              patientId: existing.patientId,
              status: { in: ['ADMITTED', 'DISCHARGE_REQUESTED'] },
            },
          });
          if (activeAdmission && !/^IPD/i.test(tokenNumber || '')) {
            tokenNumber = `IPD-${tokenNumber || ''}`.replace(/-$/, '');
          }
        }

        const updated = await tx.pharmacyBill.update({
          where: { id: existing.id },
          data: {
            tokenNumber,
            subTotal: totals.subTotal,
            discount: totals.discount,
            gstAmount: totals.gstAmount,
            grandTotal,
            paidAmount,
            pendingAmount,
            paymentMode: saveAsDraft ? null : paymentMode,
            status,
            dueDate,
            dispenseStatus:
              !saveAsDraft && existing.billingType === 'WALK_IN' && status === 'PAID'
                ? 'DISPENSED'
                : existing.dispenseStatus,
            remarks: body.remarks !== undefined ? normalizeString(body.remarks) || null : existing.remarks,
            ...(itemResult.items
              ? {
                  items: {
                    create: items.map((row) => ({
                      medicineId: row.medicineId,
                      inventoryBatchId: row.inventoryBatchId,
                      medicineName: row.medicineName,
                      batchNumber: row.batchNumber,
                      expiryDate: row.expiryDate,
                      quantity: row.quantity,
                      mrp: row.mrp,
                      sellingPrice: row.sellingPrice,
                      discountPercent: row.discountPercent,
                      gstPercentage: row.gstPercentage,
                      amount: row.amount,
                    })),
                  },
                }
              : {}),
          },
          include: BILL_INCLUDE,
        });

        if (shouldDeduct) {
          await applyStockDeduction(tx, updated, items);
        }
        return updated;
      },
      PRISMA_TX
    );

    return res.json({ message: 'Bill updated', bill: mapBill(bill) });
  } catch (err) {
    console.error('[pharmacy/billing] update', err);
    return res.status(500).json({ message: err?.message || 'Failed to update bill' });
  }
};

const cancelBill = async (req, res) => {
  try {
    const existing = await prisma.pharmacyBill.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Bill not found' });
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Bill is already cancelled' });
    }

    const bill = await prisma.$transaction(
      async (tx) => {
        if (stockWasDeducted(existing.status)) {
          await restoreStockFromBill(tx, existing);
        }
        return tx.pharmacyBill.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED', pendingAmount: 0, dispenseStatus: 'DISPENSED' },
          include: BILL_INCLUDE,
        });
      },
      PRISMA_TX
    );

    return res.json({ message: 'Bill cancelled', bill: mapBill(bill) });
  } catch (err) {
    console.error('[pharmacy/billing] cancel', err);
    return res.status(500).json({ message: 'Failed to cancel bill' });
  }
};

const getBillPrint = async (req, res) => {
  try {
    const bill = await prisma.pharmacyBill.findUnique({
      where: { id: req.params.id },
      include: BILL_INCLUDE,
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const printData = {
      hospital: getHospitalPrintMeta(),
      billNumber: bill.billNumber,
      billDate: bill.createdAt,
      billingType: bill.billingType === 'WALK_IN' ? 'Walk-in Customer' : 'Hospital Patient',
      status: bill.status,
      patient: {
        name: bill.patientName || bill.customerName || '—',
        uhid: bill.patientUhid || '—',
        mobile: bill.customerMobile || bill.patient?.mobile || '—',
        token: bill.tokenNumber || '—',
        doctor: bill.doctorName || '—',
        department: bill.department || '—',
        visitDate: bill.visitDate,
      },
      items: bill.items.map((item, idx) => ({
        sno: idx + 1,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        mrp: Number(item.mrp),
        discountPercent: Number(item.discountPercent),
        gstPercentage: item.gstPercentage,
        amount: Number(item.amount),
      })),
      subTotal: Number(bill.subTotal),
      discount: Number(bill.discount),
      gstAmount: Number(bill.gstAmount),
      grandTotal: Number(bill.grandTotal),
      paidAmount: Number(bill.paidAmount),
      pendingAmount: Number(bill.pendingAmount),
      paymentMode: bill.paymentMode || '—',
      preparedBy: bill.createdBy || 'Pharmacist',
      printGeneratedAt: new Date().toISOString(),
    };

    return res.json({ printData });
  } catch (err) {
    console.error('[pharmacy/billing] print', err);
    return res.status(500).json({ message: 'Failed to load bill for print' });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid bill id' });

    const existing = await prisma.pharmacyBill.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return res.status(404).json({ message: 'Bill not found' });
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ message: 'Only draft bills can be deleted' });
    }

    await prisma.$transaction([
      prisma.pharmacyBillItem.deleteMany({ where: { billId: id } }),
      prisma.pharmacyBill.delete({ where: { id } }),
    ]);

    return res.json({ message: 'Draft bill deleted successfully' });
  } catch (err) {
    console.error('[pharmacy/billing] delete', err);
    return res.status(500).json({ message: err?.message || 'Failed to delete draft bill' });
  }
};

module.exports = {
  searchInventory,
  searchPatients,
  getBillingStats,
  getBills,
  getBillById,
  createBill,
  updateBill,
  cancelBill,
  getPatientDues,
  getBillPrint,
  deleteBill,
};
