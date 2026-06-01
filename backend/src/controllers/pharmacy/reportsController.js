const { prisma } = require('../../config/prisma');
const {
  LOW_STOCK_MIN,
  BILL_FINALIZED,
  dateFilterFromQuery,
  withCreatedAt,
  withReceivedDate,
  daysUntil,
  groupByDay,
  groupByMonth,
  paymentModeLabel,
  billStatusLabel,
  returnTypeLabel,
  returnStatusLabel,
  deriveDueStatus,
  dueStatusLabel,
  aggregateStockByMedicine,
  toNum,
  roundMoney,
} = require('../../lib/pharmacy/reportsHelpers');

function parsePage(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
}

const getOverview = async (req, res) => {
  try {
    const range = dateFilterFromQuery(req.query);
    const billDate = withCreatedAt(range);
    const grnDate = withReceivedDate(range);
    const returnDate = withCreatedAt(range);

    const [
      revenueAgg,
      purchaseAgg,
      batches,
      dueAgg,
      returnsAgg,
      billsInRange,
      grnsInRange,
      billItems,
      topSuppliersRaw,
      stockMap,
      medicines,
      expiryBatches,
    ] = await Promise.all([
      prisma.pharmacyBill.aggregate({
        where: { ...BILL_FINALIZED, ...billDate },
        _sum: { grandTotal: true },
      }),
      prisma.pharmacyGrn.aggregate({
        where: { status: { not: 'Draft' }, ...grnDate },
        _sum: { grandTotal: true },
      }),
      prisma.pharmacyInventoryBatch.findMany({
        where: { status: 'ACTIVE', availableQty: { gt: 0 } },
        select: { availableQty: true, purchasePrice: true },
      }),
      prisma.pharmacyBill.aggregate({
        where: { status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] } },
        _sum: { pendingAmount: true },
      }),
      prisma.pharmacyReturn.aggregate({
        where: { status: 'COMPLETED', ...returnDate },
        _sum: { totalAmount: true },
      }),
      prisma.pharmacyBill.findMany({
        where: { ...BILL_FINALIZED, ...billDate },
        select: { createdAt: true, grandTotal: true },
      }),
      prisma.pharmacyGrn.findMany({
        where: { status: { not: 'Draft' }, ...grnDate },
        select: { receivedDate: true, grandTotal: true },
      }),
      prisma.pharmacyBillItem.findMany({
        where: { bill: { ...BILL_FINALIZED, ...billDate } },
        select: { medicineId: true, medicineName: true, quantity: true, amount: true },
      }),
      prisma.pharmacyGrn.groupBy({
        by: ['supplierId', 'supplierName'],
        where: { status: { not: 'Draft' }, ...grnDate },
        _sum: { grandTotal: true },
        _count: { id: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),
      aggregateStockByMedicine(prisma),
      prisma.pharmacyMedicine.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, medicineName: true },
      }),
      prisma.pharmacyInventoryBatch.findMany({
        where: { status: 'ACTIVE', availableQty: { gt: 0 } },
        select: { medicineName: true, batchNumber: true, expiryDate: true, availableQty: true },
        orderBy: { expiryDate: 'asc' },
        take: 20,
      }),
    ]);

    const inventoryValue = roundMoney(
      batches.reduce((s, b) => s + b.availableQty * toNum(b.purchasePrice), 0)
    );

    const salesTrend = groupByDay(billsInRange, 'createdAt', 'grandTotal');
    const purchaseTrend = groupByDay(
      grnsInRange.map((g) => ({ createdAt: g.receivedDate, grandTotal: g.grandTotal })),
      'createdAt',
      'grandTotal'
    );

    const revenueVsPurchase = salesTrend.map((s, i) => ({
      label: s.label,
      revenue: s.amount,
      purchase: purchaseTrend[i]?.amount || 0,
    }));

    const medSales = new Map();
    billItems.forEach((item) => {
      const cur = medSales.get(item.medicineId) || { medicineName: item.medicineName, qty: 0, amount: 0 };
      cur.qty += item.quantity;
      cur.amount = roundMoney(cur.amount + toNum(item.amount));
      medSales.set(item.medicineId, cur);
    });
    const topSellingMedicines = [...medSales.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((m) => ({ medicineName: m.medicineName, quantity: m.qty, amount: m.amount }));

    const lowStockAlerts = medicines
      .map((m) => {
        const stock = stockMap.get(m.id);
        const qty = stock?.availableQty || 0;
        return { medicineName: m.medicineName, availableQty: qty };
      })
      .filter((m) => m.availableQty < LOW_STOCK_MIN)
      .slice(0, 8);

    const expiryAlerts = expiryBatches
      .map((b) => ({
        medicineName: b.medicineName,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        daysRemaining: daysUntil(b.expiryDate),
        availableQty: b.availableQty,
      }))
      .filter((b) => b.daysRemaining != null && b.daysRemaining <= 90)
      .slice(0, 8);

    return res.json({
      cards: {
        totalRevenue: roundMoney(revenueAgg._sum.grandTotal),
        totalPurchaseValue: roundMoney(purchaseAgg._sum.grandTotal),
        currentInventoryValue: inventoryValue,
        totalOutstandingDues: roundMoney(dueAgg._sum.pendingAmount),
        totalReturnsValue: roundMoney(returnsAgg._sum.totalAmount),
      },
      charts: {
        salesTrend,
        purchaseTrend,
        revenueVsPurchase,
      },
      widgets: {
        topSellingMedicines,
        topSuppliers: topSuppliersRaw.map((s) => ({
          supplierName: s.supplierName,
          purchaseValue: roundMoney(s._sum.grandTotal),
          grnCount: s._count.id,
        })),
        lowStockAlerts,
        expiryAlerts,
      },
    });
  } catch (err) {
    console.error('[pharmacy/reports] overview', err);
    return res.status(500).json({ message: 'Failed to fetch overview report' });
  }
};

const getSalesReport = async (req, res) => {
  try {
    const range = dateFilterFromQuery(req.query);
    const { page, limit, skip } = parsePage(req.query);
    const where = { ...BILL_FINALIZED, ...withCreatedAt(range) };

    const [agg, count, bills, paymentsAgg] = await Promise.all([
      prisma.pharmacyBill.aggregate({ where, _sum: { grandTotal: true, paidAmount: true }, _avg: { grandTotal: true } }),
      prisma.pharmacyBill.count({ where }),
      prisma.pharmacyBill.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          billNumber: true,
          patientName: true,
          customerName: true,
          createdAt: true,
          grandTotal: true,
          paidAmount: true,
          paymentMode: true,
          status: true,
        },
      }),
      prisma.pharmacyPayment.aggregate({
        where: range ? { createdAt: range } : {},
        _sum: { amount: true },
      }),
    ]);

    const allBills = await prisma.pharmacyBill.findMany({
      where,
      select: { createdAt: true, grandTotal: true, paymentMode: true },
    });

    const dailySales = groupByDay(allBills, 'createdAt', 'grandTotal');
    const monthlySales = groupByMonth(allBills, 'createdAt', 'grandTotal');

    const modeMap = new Map();
    allBills.forEach((b) => {
      const key = b.paymentMode || 'UNKNOWN';
      modeMap.set(key, (modeMap.get(key) || 0) + 1);
    });
    const paymentModeDistribution = [...modeMap.entries()].map(([mode, count]) => ({
      mode,
      label: paymentModeLabel(mode),
      count,
    }));

    return res.json({
      cards: {
        totalSales: roundMoney(agg._sum.grandTotal),
        totalBills: count,
        averageBillValue: roundMoney(agg._avg.grandTotal),
        collectionAmount: roundMoney(paymentsAgg._sum.amount || agg._sum.paidAmount),
      },
      charts: { dailySales, monthlySales, paymentModeDistribution },
      table: bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        patientName: b.patientName || b.customerName || '—',
        billDate: b.createdAt,
        amount: roundMoney(b.grandTotal),
        paymentMode: paymentModeLabel(b.paymentMode),
        status: billStatusLabel(b.status),
      })),
      total: count,
      page,
      limit,
    });
  } catch (err) {
    console.error('[pharmacy/reports] sales', err);
    return res.status(500).json({ message: 'Failed to fetch sales report' });
  }
};

const getPurchaseReport = async (req, res) => {
  try {
    const range = dateFilterFromQuery(req.query);
    const { page, limit, skip } = parsePage(req.query);
    const grnWhere = { status: { not: 'Draft' }, ...withReceivedDate(range) };

    const [purchaseAgg, grnCount, pendingPo, activeSuppliers, pos, grns, supplierWise] = await Promise.all([
      prisma.pharmacyGrn.aggregate({ where: grnWhere, _sum: { grandTotal: true } }),
      prisma.pharmacyGrn.count({ where: grnWhere }),
      prisma.pharmacyPurchaseOrder.count({
        where: { status: { in: ['Draft', 'Pending', 'Partial', 'Approved'] } },
      }),
      prisma.pharmacySupplier.count({ where: { status: 'ACTIVE' } }),
      prisma.pharmacyPurchaseOrder.findMany({
        where: withCreatedAt(range),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          poNumber: true,
          supplierName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.pharmacyGrn.findMany({
        where: grnWhere,
        select: { receivedDate: true, grandTotal: true, supplierName: true },
      }),
      prisma.pharmacyGrn.groupBy({
        by: ['supplierName'],
        where: grnWhere,
        _sum: { grandTotal: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 10,
      }),
    ]);

    return res.json({
      cards: {
        totalPurchaseValue: roundMoney(purchaseAgg._sum.grandTotal),
        totalGrns: grnCount,
        pendingPurchaseOrders: pendingPo,
        activeSuppliers,
      },
      charts: {
        monthlyPurchases: groupByMonth(
          grns.map((g) => ({ createdAt: g.receivedDate, grandTotal: g.grandTotal })),
          'createdAt',
          'grandTotal'
        ),
        supplierWisePurchases: supplierWise.map((s) => ({
          supplierName: s.supplierName,
          amount: roundMoney(s._sum.grandTotal),
        })),
      },
      table: pos.map((p) => ({
        id: p.id,
        poNumber: p.poNumber,
        supplier: p.supplierName,
        purchaseAmount: roundMoney(p.grandTotal),
        status: p.status,
        date: p.createdAt,
      })),
      total: await prisma.pharmacyPurchaseOrder.count({ where: withCreatedAt(range) }),
      page,
      limit,
    });
  } catch (err) {
    console.error('[pharmacy/reports] purchase', err);
    return res.status(500).json({ message: 'Failed to fetch purchase report' });
  }
};

const getInventoryReport = async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const [medicines, stockMap, batches] = await Promise.all([
      prisma.pharmacyMedicine.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { medicineName: 'asc' },
        select: { id: true, medicineName: true, category: true },
      }),
      aggregateStockByMedicine(prisma),
      prisma.pharmacyInventoryBatch.findMany({
        where: { status: 'ACTIVE' },
        select: { medicineId: true, availableQty: true, purchasePrice: true },
      }),
    ]);

    const medCategories = await prisma.pharmacyMedicine.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, category: true },
    });
    const catMap = new Map(medCategories.map((m) => [m.id, m.category]));

    const categoryStock = new Map();
    batches.forEach((b) => {
      const cat = catMap.get(b.medicineId) || 'Other';
      const val = b.availableQty * toNum(b.purchasePrice);
      categoryStock.set(cat, roundMoney((categoryStock.get(cat) || 0) + val));
    });

    const rows = medicines.map((m) => {
      const s = stockMap.get(m.id) || { availableQty: 0, inventoryValue: 0, batchCount: 0 };
      return {
        medicine: m.medicineName,
        category: m.category,
        availableQty: s.availableQty,
        batchCount: s.batchCount,
        inventoryValue: s.inventoryValue,
      };
    });

    const totalStock = rows.reduce((s, r) => s + r.availableQty, 0);
    const totalValue = roundMoney(rows.reduce((s, r) => s + r.inventoryValue, 0));
    const activeBatches = await prisma.pharmacyInventoryBatch.count({ where: { status: 'ACTIVE' } });

    const paged = rows.slice(skip, skip + limit);

    return res.json({
      cards: {
        totalMedicines: medicines.length,
        totalStock,
        totalInventoryValue: totalValue,
        activeBatches,
      },
      charts: {
        categoryWiseStock: [...categoryStock.entries()].map(([category, value]) => ({ category, value })),
        inventoryDistribution: [...categoryStock.entries()].map(([name, value]) => ({ name, value })),
      },
      table: paged,
      total: rows.length,
      page,
      limit,
    });
  } catch (err) {
    console.error('[pharmacy/reports] inventory', err);
    return res.status(500).json({ message: 'Failed to fetch inventory report' });
  }
};

const getLowStockReport = async (req, res) => {
  try {
    const [medicines, stockMap] = await Promise.all([
      prisma.pharmacyMedicine.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, medicineName: true },
        orderBy: { medicineName: 'asc' },
      }),
      aggregateStockByMedicine(prisma),
    ]);

    const rows = medicines
      .map((m) => {
        const qty = stockMap.get(m.id)?.availableQty || 0;
        const status = qty <= 0 ? 'Out of Stock' : qty < LOW_STOCK_MIN ? 'Low Stock' : 'In Stock';
        return {
          medicine: m.medicineName,
          currentStock: qty,
          minimumLevel: LOW_STOCK_MIN,
          requiredQuantity: Math.max(0, LOW_STOCK_MIN - qty),
          status,
        };
      })
      .filter((r) => r.currentStock < LOW_STOCK_MIN);

    const outOfStock = rows.filter((r) => r.currentStock <= 0).length;
    const lowStock = rows.filter((r) => r.currentStock > 0).length;

    return res.json({
      cards: {
        lowStockMedicines: lowStock,
        outOfStockMedicines: outOfStock,
        reorderRequired: rows.length,
      },
      table: rows,
      total: rows.length,
    });
  } catch (err) {
    console.error('[pharmacy/reports] low-stock', err);
    return res.status(500).json({ message: 'Failed to fetch low stock report' });
  }
};

const getExpiryReport = async (req, res) => {
  try {
    const batches = await prisma.pharmacyInventoryBatch.findMany({
      where: { status: { in: ['ACTIVE', 'EXPIRED'] }, availableQty: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
      select: {
        medicineName: true,
        batchNumber: true,
        expiryDate: true,
        availableQty: true,
        purchasePrice: true,
      },
    });

    let expired = 0;
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;

    const table = batches.map((b) => {
      const days = daysUntil(b.expiryDate);
      if (days != null && days < 0) expired += 1;
      else if (days != null && days <= 30) d30 += 1;
      else if (days != null && days <= 60) d60 += 1;
      else if (days != null && days <= 90) d90 += 1;
      return {
        medicine: b.medicineName,
        batch: b.batchNumber,
        expiryDate: b.expiryDate,
        availableQty: b.availableQty,
        purchaseValue: roundMoney(b.availableQty * toNum(b.purchasePrice)),
        daysRemaining: days,
      };
    });

    return res.json({
      cards: { expiredMedicines: expired, expiringIn30Days: d30, expiringIn60Days: d60, expiringIn90Days: d90 },
      table,
      total: table.length,
    });
  } catch (err) {
    console.error('[pharmacy/reports] expiry', err);
    return res.status(500).json({ message: 'Failed to fetch expiry report' });
  }
};

const getSupplierReport = async (req, res) => {
  try {
    const range = dateFilterFromQuery(req.query);
    const grnWhere = { status: { not: 'Draft' }, ...withReceivedDate(range) };
    const returnWhere = { status: 'COMPLETED', returnType: { in: ['VENDOR_RETURN', 'DAMAGED_RETURN'] }, ...withCreatedAt(range) };

    const [suppliers, purchaseBySupplier, returnsBySupplier] = await Promise.all([
      prisma.pharmacySupplier.findMany({ orderBy: { supplierName: 'asc' } }),
      prisma.pharmacyGrn.groupBy({
        by: ['supplierId'],
        where: grnWhere,
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      prisma.pharmacyReturn.groupBy({
        by: ['supplierId'],
        where: returnWhere,
        _sum: { totalAmount: true },
      }),
    ]);

    const purchaseMap = new Map(purchaseBySupplier.map((p) => [p.supplierId, p]));
    const returnMap = new Map(returnsBySupplier.map((r) => [r.supplierId, toNum(r._sum.totalAmount)]));

    const table = suppliers.map((s) => {
      const p = purchaseMap.get(s.id);
      return {
        supplier: s.supplierName,
        orders: p?._count?.id || 0,
        purchaseValue: roundMoney(p?._sum?.grandTotal),
        returns: returnMap.get(s.id) || 0,
        status: s.status === 'INACTIVE' ? 'Inactive' : 'Active',
      };
    });

    const chartData = table
      .filter((t) => t.purchaseValue > 0)
      .sort((a, b) => b.purchaseValue - a.purchaseValue)
      .slice(0, 10);

    const totalPurchase = roundMoney(table.reduce((s, t) => s + t.purchaseValue, 0));
    const vendorReturns = roundMoney(table.reduce((s, t) => s + t.returns, 0));

    return res.json({
      cards: {
        totalSuppliers: suppliers.length,
        totalPurchaseValue: totalPurchase,
        vendorReturns,
        activeSuppliers: suppliers.filter((s) => s.status === 'ACTIVE').length,
      },
      charts: { supplierPurchaseDistribution: chartData.map((t) => ({ name: t.supplier, value: t.purchaseValue })) },
      table,
      total: table.length,
    });
  } catch (err) {
    console.error('[pharmacy/reports] suppliers', err);
    return res.status(500).json({ message: 'Failed to fetch supplier report' });
  }
};

const getReturnsReport = async (req, res) => {
  try {
    const range = dateFilterFromQuery(req.query);
    const { page, limit, skip } = parsePage(req.query);
    const where = { NOT: { status: 'CANCELLED' }, ...withCreatedAt(range) };

    const [total, customer, vendor, expired, returns] = await Promise.all([
      prisma.pharmacyReturn.count({ where }),
      prisma.pharmacyReturn.count({ where: { ...where, returnType: 'CUSTOMER_RETURN' } }),
      prisma.pharmacyReturn.count({
        where: { ...where, returnType: { in: ['VENDOR_RETURN', 'DAMAGED_RETURN'] } },
      }),
      prisma.pharmacyReturn.count({ where: { ...where, returnType: 'EXPIRED_RETURN' } }),
      prisma.pharmacyReturn.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const allReturns = await prisma.pharmacyReturn.findMany({
      where,
      select: { createdAt: true, totalAmount: true, returnType: true },
    });

    const returnTrends = groupByDay(
      allReturns.map((r) => ({ createdAt: r.createdAt, grandTotal: r.totalAmount })),
      'createdAt',
      'grandTotal'
    );

    const typeMap = new Map();
    allReturns.forEach((r) => {
      typeMap.set(r.returnType, (typeMap.get(r.returnType) || 0) + 1);
    });

    return res.json({
      cards: { totalReturns: total, customerReturns: customer, vendorReturns: vendor, expiredReturns: expired },
      charts: {
        returnTrends,
        returnTypeDistribution: [...typeMap.entries()].map(([type, count]) => ({
          type,
          label: returnTypeLabel(type),
          count,
        })),
      },
      table: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        returnType: returnTypeLabel(r.returnType),
        reference: r.referenceNumber || '—',
        amount: roundMoney(r.totalAmount),
        status: returnStatusLabel(r.status),
        date: r.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[pharmacy/reports] returns', err);
    return res.status(500).json({ message: 'Failed to fetch returns report' });
  }
};

const getDuesReport = async (req, res) => {
  try {
    const range = dateFilterFromQuery(req.query);
    const { page, limit, skip } = parsePage(req.query);

    const bills = await prisma.pharmacyBill.findMany({
      where: { status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] } },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    const paymentsInRange = range
      ? await prisma.pharmacyPayment.aggregate({
          where: { createdAt: range },
          _sum: { amount: true },
        })
      : { _sum: { amount: 0 } };

    let outstanding = 0;
    let pendingAccounts = 0;
    let overdueAccounts = 0;

    const rows = bills.map((b) => {
      const dueStatus = deriveDueStatus(b);
      const pending = roundMoney(b.pendingAmount);
      outstanding += pending;
      if (pending > 0) pendingAccounts += 1;
      if (dueStatus === 'OVERDUE') overdueAccounts += 1;
      const lastPayment = b.payments[0]?.createdAt || null;
      return {
        patientName: b.patientName || b.customerName || '—',
        uhid: b.patientUhid || '—',
        billNumber: b.billNumber,
        pendingAmount: pending,
        lastPaymentDate: lastPayment,
        status: dueStatusLabel(dueStatus),
      };
    });

    const dueTrend = range
      ? groupByDay(
          await prisma.pharmacyPayment.findMany({
            where: { createdAt: range },
            select: { createdAt: true, amount: true },
          }),
          'createdAt',
          'amount'
        )
      : [];

    const paged = rows.slice(skip, skip + limit);

    return res.json({
      cards: {
        outstandingAmount: roundMoney(outstanding),
        collectedAmount: roundMoney(paymentsInRange._sum.amount),
        pendingAccounts,
        overdueAccounts,
      },
      charts: { dueCollectionTrend: dueTrend },
      table: paged,
      total: rows.length,
      page,
      limit,
    });
  } catch (err) {
    console.error('[pharmacy/reports] dues', err);
    return res.status(500).json({ message: 'Failed to fetch dues report' });
  }
};

module.exports = {
  getOverview,
  getSalesReport,
  getPurchaseReport,
  getInventoryReport,
  getLowStockReport,
  getExpiryReport,
  getSupplierReport,
  getReturnsReport,
  getDuesReport,
};
