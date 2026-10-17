const { prisma } = require('../../config/prisma');

exports.pendingList = async (req, res) => {
  try {
    const issues = await prisma.otMedicineIssue.findMany({
      where: { status: { in: ['REQUESTED'] } },
      orderBy: { requestedAt: 'desc' },
      include: {
        patient: { select: { uhid: true, name: true } },
        surgerySession: { select: { startTime: true, endTime: true } },
        items: true,
      },
    });
    return res.json({ issues });
  } catch (err) {
    console.error('[pharmacy/ot-issue] pendingList', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.history = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    const [issues, total] = await Promise.all([
      prisma.otMedicineIssue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(pageSize),
        take: parseInt(pageSize),
        include: {
          patient: { select: { uhid: true, name: true } },
          items: true,
        },
      }),
      prisma.otMedicineIssue.count({ where }),
    ]);
    return res.json({ issues, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('[pharmacy/ot-issue] history', err);
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
    console.error('[pharmacy/ot-issue] getIssue', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.issueItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const userId = req.user.userId || req.user.id;
    const userName = req.user.name || '';

    const issue = await prisma.otMedicineIssue.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (issue.status !== 'REQUESTED') return res.status(400).json({ message: 'Issue is not in REQUESTED status' });

    for (const item of items) {
      const existingItem = issue.items.find((i) => i.id === item.issueItemId);
      if (!existingItem) {
        return res.status(400).json({ message: `Item ${item.issueItemId} not found` });
      }
      const batch = await prisma.pharmacyInventoryBatch.findUnique({
        where: { id: existingItem.inventoryBatchId },
        select: { id: true, availableQty: true },
      });
      if (!batch || batch.availableQty < item.quantityIssued) {
        return res.status(400).json({
          message: `Insufficient stock for ${existingItem.medicineName} (batch: ${existingItem.batchNumber})`,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const existingItem = issue.items.find((i) => i.id === item.issueItemId);
        const batch = await tx.pharmacyInventoryBatch.findUnique({
          where: { id: existingItem.inventoryBatchId },
          select: { id: true, availableQty: true },
        });
        if (!batch || batch.availableQty < item.quantityIssued) {
          throw new Error(`Insufficient stock for ${existingItem.medicineName}`);
        }

        const lineTotal = item.quantityIssued * existingItem.unitPrice;
        const newBalance = batch.availableQty - item.quantityIssued;

        await tx.pharmacyInventoryBatch.update({
          where: { id: existingItem.inventoryBatchId },
          data: {
            availableQty: newBalance,
            status: newBalance <= 0 ? 'DEPLETED' : 'ACTIVE',
          },
        });

        await tx.pharmacyStockTransaction.create({
          data: {
            medicineId: existingItem.medicineId,
            batchId: existingItem.inventoryBatchId,
            type: 'OT_ISSUE',
            qtyIn: 0,
            qtyOut: item.quantityIssued,
            balance: newBalance,
            referenceType: 'OT_MEDICINE_ISSUE',
            referenceId: id,
            notes: `Issued to OT: ${issue.issueNumber} — batch ${existingItem.batchNumber}`,
          },
        });

        await tx.otMedicineIssueItem.update({
          where: { id: item.issueItemId },
          data: {
            quantityIssued: item.quantityIssued,
            lineIssuedTotal: lineTotal,
            lineNetTotal: lineTotal,
          },
        });

        await tx.otMedicineMovement.create({
          data: {
            issueId: id,
            issueItemId: item.issueItemId,
            movementType: 'ISSUE',
            quantity: item.quantityIssued,
            performedById: userId,
            performedByName: userName,
            notes: `Pharmacy issued ${item.quantityIssued} units`,
          },
        });
      }

      await tx.otMedicineIssue.update({
        where: { id },
        data: {
          status: 'ISSUED',
          issuedById: userId,
          issuedByName: userName,
          issuedAt: new Date(),
        },
      });

      return tx.otMedicineIssue.findUnique({
        where: { id },
        include: { items: true, movements: { orderBy: { movementAt: 'asc' } } },
      });
    });

    return res.json({ issue: result });
  } catch (err) {
    console.error('[pharmacy/ot-issue] issueItems', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.confirmReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;
    const userName = req.user.name || '';

    const issue = await prisma.otMedicineIssue.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (issue.status !== 'RETURN_PENDING') return res.status(400).json({ message: 'No pending return for this issue' });

    const result = await prisma.$transaction(async (tx) => {
      for (const item of issue.items) {
        if (item.quantityReturnPending <= 0) continue;

        const returnQty = item.quantityReturnPending;

        const batch = await tx.pharmacyInventoryBatch.findUnique({
          where: { id: item.inventoryBatchId },
          select: { id: true, availableQty: true },
        });
        if (!batch) throw new Error(`Batch not found for ${item.medicineName}`);

        const newBalance = batch.availableQty + returnQty;

        await tx.pharmacyInventoryBatch.update({
          where: { id: item.inventoryBatchId },
          data: {
            availableQty: newBalance,
            status: 'ACTIVE',
          },
        });

        await tx.pharmacyStockTransaction.create({
          data: {
            medicineId: item.medicineId,
            batchId: item.inventoryBatchId,
            type: 'OT_RETURN',
            qtyIn: returnQty,
            qtyOut: 0,
            balance: newBalance,
            referenceType: 'OT_MEDICINE_ISSUE',
            referenceId: id,
            notes: `Returned from OT: ${issue.issueNumber} — batch ${item.batchNumber}`,
          },
        });

        const newReturned = item.quantityReturned + returnQty;
        const newNet = item.lineIssuedTotal - item.lineUsedTotal - (newReturned * item.unitPrice);

        await tx.otMedicineIssueItem.update({
          where: { id: item.id },
          data: {
            quantityReturned: newReturned,
            quantityReturnPending: 0,
            lineReturnedTotal: newReturned * item.unitPrice,
            lineNetTotal: newNet,
          },
        });

        await tx.otMedicineMovement.create({
          data: {
            issueId: id,
            issueItemId: item.id,
            movementType: 'RETURN_CONFIRMED',
            quantity: returnQty,
            performedById: userId,
            performedByName: userName,
            notes: `Pharmacy confirmed return of ${returnQty} units`,
          },
        });
      }

      await tx.otMedicineIssue.update({
        where: { id },
        data: {
          status: 'CLOSED',
          returnConfirmedAt: new Date(),
          returnConfirmedById: userId,
        },
      });

      return tx.otMedicineIssue.findUnique({
        where: { id },
        include: { items: true, movements: { orderBy: { movementAt: 'asc' } } },
      });
    });

    return res.json({ issue: result });
  } catch (err) {
    console.error('[pharmacy/ot-issue] confirmReturn', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
