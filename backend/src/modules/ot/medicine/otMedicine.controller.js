const { prisma } = require('../../../config/prisma');

exports.listIssues = async (req, res) => {
  try {
    const { surgerySessionId } = req.query;
    const where = {};
    if (surgerySessionId) where.surgerySessionId = surgerySessionId;
    const issues = await prisma.otMedicineIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { uhid: true, name: true } },
        surgerySession: { select: { startTime: true, endTime: true } },
        items: true,
        movements: { orderBy: { movementAt: 'desc' }, take: 10 },
      },
    });
    return res.json({ issues });
  } catch (err) {
    console.error('[ot/medicine] listIssues', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getIssue = async (req, res) => {
  try {
    const issue = await prisma.otMedicineIssue.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { uhid: true, name: true } },
        surgerySession: true,
        items: true,
        movements: { orderBy: { movementAt: 'asc' } },
      },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    return res.json({ issue });
  } catch (err) {
    console.error('[ot/medicine] getIssue', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.requestIssue = async (req, res) => {
  try {
    const { surgerySessionId, otRequestId, patientId, remarks, items } = req.body;
    const userId = req.user.userId || req.user.id;
    const userName = req.user.name || '';

    const last = await prisma.otMedicineIssue.findFirst({ orderBy: { createdAt: 'desc' } });
    const seq = last ? parseInt(last.issueNumber.replace('OTM-', '')) + 1 : 1;
    const issueNumber = `OTM-${String(seq).padStart(4, '0')}`;

    const issue = await prisma.otMedicineIssue.create({
      data: {
        issueNumber,
        surgerySessionId,
        otRequestId,
        patientId,
        status: 'REQUESTED',
        requestedById: userId,
        requestedByName: userName,
        requestedAt: new Date(),
        remarks,
        items: {
          create: items.map((item) => ({
            medicineId: item.medicineId,
            inventoryBatchId: item.inventoryBatchId || '',
            medicineName: item.medicineName,
            genericName: item.genericName || null,
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            quantityRequested: item.quantityRequested,
            quantityIssued: 0,
            quantityUsed: 0,
            quantityReturned: 0,
            quantityReturnPending: 0,
            unitPrice: item.unitPrice || 0,
            lineIssuedTotal: 0,
            lineUsedTotal: 0,
            lineReturnedTotal: 0,
            lineNetTotal: 0,
          })),
        },
        movements: {
          create: {
            movementType: 'REQUEST',
            quantity: items.reduce((s, i) => s + i.quantityRequested, 0),
            performedById: userId,
            performedByName: userName,
            notes: 'Initial request',
          },
        },
      },
      include: { items: true, movements: true },
    });

    return res.status(201).json({ issue });
  } catch (err) {
    console.error('[ot/medicine] requestIssue', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.receiveIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;
    const userName = req.user.name || '';

    const issue = await prisma.otMedicineIssue.findUnique({ where: { id } });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (issue.status !== 'ISSUED') return res.status(400).json({ message: 'Issue has not been issued by pharmacy yet' });

    const updated = await prisma.otMedicineIssue.update({
      where: { id },
      data: {
        status: 'IN_USE',
        receivedByOtId: userId,
        receivedByOtName: userName,
        movements: {
          create: {
            movementType: 'ISSUE',
            quantity: 0,
            performedById: userId,
            performedByName: userName,
            notes: 'OT received items from pharmacy',
          },
        },
      },
      include: { items: true, movements: true },
    });

    return res.json({ issue: updated });
  } catch (err) {
    console.error('[ot/medicine] receiveIssue', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.logUse = async (req, res) => {
  try {
    const { id } = req.params;
    const { items: usageItems } = req.body;
    const userId = req.user.userId || req.user.id;
    const userName = req.user.name || '';

    const issue = await prisma.otMedicineIssue.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const updates = usageItems.map(async (ui) => {
      const item = issue.items.find((i) => i.id === ui.issueItemId);
      if (!item) return;
      const newUsed = item.quantityUsed + ui.quantity;
      const newNet = item.lineIssuedTotal - (item.lineUsedTotal + (newUsed * item.unitPrice));
      await prisma.otMedicineIssueItem.update({
        where: { id: ui.issueItemId },
        data: {
          quantityUsed: newUsed,
          lineUsedTotal: newUsed * item.unitPrice,
          lineNetTotal: newNet,
        },
      });
      await prisma.otMedicineMovement.create({
        data: {
          issueId: id,
          issueItemId: ui.issueItemId,
          movementType: 'USE',
          quantity: ui.quantity,
          performedById: userId,
          performedByName: userName,
          notes: ui.notes || null,
        },
      });
    });
    await Promise.all(updates);

    const updatedIssue = await prisma.otMedicineIssue.findUnique({
      where: { id },
      include: { items: true, movements: { orderBy: { movementAt: 'desc' }, take: 10 } },
    });
    return res.json({ issue: updatedIssue });
  } catch (err) {
    console.error('[ot/medicine] logUse', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.requestReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { items: returnItems, notes } = req.body;
    const userId = req.user.userId || req.user.id;
    const userName = req.user.name || '';

    const issue = await prisma.otMedicineIssue.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const updates = returnItems.map(async (ri) => {
      const item = issue.items.find((i) => i.id === ri.issueItemId);
      if (!item) return;
      const newReturnPending = item.quantityReturnPending + ri.quantity;
      await prisma.otMedicineIssueItem.update({
        where: { id: ri.issueItemId },
        data: { quantityReturnPending: newReturnPending },
      });
      await prisma.otMedicineMovement.create({
        data: {
          issueId: id,
          issueItemId: ri.issueItemId,
          movementType: 'RETURN_SUBMITTED',
          quantity: ri.quantity,
          performedById: userId,
          performedByName: userName,
          notes: ri.notes || notes || null,
        },
      });
    });
    await Promise.all(updates);

    const updated = await prisma.otMedicineIssue.update({
      where: { id },
      data: { status: 'RETURN_PENDING', returnSubmittedAt: new Date() },
      include: { items: true, movements: { orderBy: { movementAt: 'desc' }, take: 10 } },
    });

    return res.json({ issue: updated });
  } catch (err) {
    console.error('[ot/medicine] requestReturn', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.inventorySearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ batches: [] });
    const medicines = await prisma.pharmacyMedicine.findMany({
      where: {
        OR: [
          { medicineName: { contains: q, mode: 'insensitive' } },
          { genericName: { contains: q, mode: 'insensitive' } },
          { brandName: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        medicineName: true,
        genericName: true,
        brandName: true,
        barcode: true,
        strength: true,
        dosageForm: true,
        category: true,
        inventoryBatches: {
          where: { availableQty: { gt: 0 } },
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            purchasePrice: true,
            mrp: true,
            availableQty: true,
          },
          orderBy: { expiryDate: 'asc' },
        },
      },
      take: 20,
    });
    const batches = medicines.flatMap((m) =>
      m.inventoryBatches.map((b) => ({
        medicineId: m.id,
        medicineName: m.medicineName,
        genericName: m.genericName || '',
        brandName: m.brandName || '',
        barcode: m.barcode || '',
        unitStrength: m.strength || '',
        form: m.dosageForm || '',
        packageType: m.category || '',
        inventoryBatchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        unitPrice: Math.round(Number(b.mrp) || Number(b.purchasePrice) || 0),
        remainingQty: b.availableQty,
      }))
    );
    return res.json({ batches });
  } catch (err) {
    console.error('[ot/medicine] inventorySearch', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
