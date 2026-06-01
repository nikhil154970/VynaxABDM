const { prisma } = require('../../config/prisma');
const { toNum } = require('../../lib/pharmacy/helpers');

const LOW_STOCK_MIN = Number(process.env.PHARMACY_LOW_STOCK_MIN) || 20;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function billStatusLabel(status) {
  const map = {
    PAID: 'Paid',
    PARTIALLY_PAID: 'Partially Paid',
    PENDING_PAYMENT: 'Pending',
    CANCELLED: 'Cancelled',
    DRAFT: 'Draft',
  };
  return map[status] || status;
}

function stockStatusLabel(available) {
  const qty = Number(available) || 0;
  if (qty <= 0) return 'Critical';
  if (qty < LOW_STOCK_MIN) return qty < LOW_STOCK_MIN / 2 ? 'Critical' : 'Low';
  return 'Low';
}

function supplierStatusLabel(row) {
  if (row.status === 'INACTIVE') return 'Inactive';
  if (Number(row.outstandingAmount || 0) > 0) return 'Due';
  return 'Active';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

async function aggregateBatchByMedicine() {
  const batches = await prisma.pharmacyInventoryBatch.findMany({
    where: { status: { in: ['ACTIVE', 'DEPLETED', 'EXPIRED'] } },
    select: { medicineId: true, availableQty: true },
  });
  const map = new Map();
  for (const b of batches) {
    map.set(b.medicineId, (map.get(b.medicineId) || 0) + b.availableQty);
  }
  return map;
}

const getDashboard = async (req, res) => {
  try {
    const todayStart = toStartOfDay(new Date());
    const todayEnd = toEndOfDay(new Date());
    const yesterdayStart = toStartOfDay(new Date(Date.now() - 86400000));
    const yesterdayEnd = toEndOfDay(new Date(Date.now() - 86400000));

    const last7 = getLast7Days();
    const weekStart = toStartOfDay(last7[0]);
    const weekEnd = toEndOfDay(last7[6]);

    const billWhereFinalized = { status: { notIn: ['DRAFT', 'CANCELLED'] } };

    const [
      todaySalesAgg,
      yesterdaySalesAgg,
      weekBills,
      pendingQueueCount,
      recentBillsRaw,
      queueRows,
      medicines,
      batchMap,
      suppliersRaw,
      supplierStats,
    ] = await Promise.all([
      prisma.pharmacyBill.aggregate({
        where: { ...billWhereFinalized, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { grandTotal: true },
      }),
      prisma.pharmacyBill.aggregate({
        where: { ...billWhereFinalized, createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        _sum: { grandTotal: true },
      }),
      prisma.pharmacyBill.findMany({
        where: { ...billWhereFinalized, createdAt: { gte: weekStart, lte: weekEnd } },
        select: { createdAt: true, grandTotal: true, billingType: true },
      }),
      prisma.pharmacyQueue.count({ where: { status: { in: ['WAITING', 'IN_PROGRESS'] } } }),
      prisma.pharmacyBill.findMany({
        where: billWhereFinalized,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          billNumber: true,
          patientName: true,
          customerName: true,
          billingType: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.pharmacyQueue.findMany({
        where: { status: { in: ['WAITING', 'IN_PROGRESS'] } },
        orderBy: { sentAt: 'desc' },
        take: 5,
        include: {
          patient: { select: { name: true } },
          doctor: { select: { user: { select: { name: true } } } },
          items: { select: { id: true } },
        },
      }),
      prisma.pharmacyMedicine.findMany({ where: { status: 'ACTIVE' }, select: { id: true, medicineName: true } }),
      aggregateBatchByMedicine(),
      prisma.pharmacySupplier.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 }),
      prisma.pharmacySupplier.groupBy({
        by: ['status'],
        _count: true,
        _sum: { outstandingAmount: true },
      }),
    ]);

    const todaySales = roundMoney(Number(todaySalesAgg._sum.grandTotal || 0));
    const yesterdaySales = roundMoney(Number(yesterdaySalesAgg._sum.grandTotal || 0));
    let salesChangePct = 0;
    if (yesterdaySales > 0) {
      salesChangePct = Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100);
    } else if (todaySales > 0) {
      salesChangePct = 100;
    }

    const salesByDay = new Map(last7.map((d) => [dateKey(d), 0]));
    weekBills.forEach((b) => {
      const key = dateKey(new Date(b.createdAt));
      if (salesByDay.has(key)) {
        salesByDay.set(key, salesByDay.get(key) + Number(b.grandTotal));
      }
    });

    const salesChart = last7.map((d) => ({
      day: DAY_LABELS[d.getDay()],
      date: dateKey(d),
      amount: roundMoney(salesByDay.get(dateKey(d)) || 0),
    }));

    let hospitalAmount = 0;
    let walkInAmount = 0;
    weekBills.forEach((b) => {
      const amt = Number(b.grandTotal);
      if (b.billingType === 'WALK_IN') walkInAmount += amt;
      else hospitalAmount += amt;
    });
    hospitalAmount = roundMoney(hospitalAmount);
    walkInAmount = roundMoney(walkInAmount);
    const distributionTotal = roundMoney(hospitalAmount + walkInAmount);
    const hospitalPct = distributionTotal > 0 ? Math.round((hospitalAmount / distributionTotal) * 100) : 0;
    const walkInPct = distributionTotal > 0 ? 100 - hospitalPct : 0;

    const billingDistribution = [
      { name: 'Hospital Patients', value: hospitalPct, amount: hospitalAmount, color: '#2563eb' },
      { name: 'Walk-in Customers', value: walkInPct, amount: walkInAmount, color: '#38b260' },
    ];

    const lowStockRows = medicines
      .map((m) => ({
        medicineName: m.medicineName,
        availableStock: batchMap.get(m.id) || 0,
      }))
      .filter((r) => r.availableStock < LOW_STOCK_MIN)
      .sort((a, b) => a.availableStock - b.availableStock)
      .slice(0, 5)
      .map((r) => ({
        medicineName: r.medicineName,
        stockLabel: `${r.availableStock} units`,
        status: stockStatusLabel(r.availableStock),
      }));

    const lowStockCount = medicines.filter((m) => (batchMap.get(m.id) || 0) < LOW_STOCK_MIN).length;

    let totalSuppliers = 0;
    let suppliersNeedFollowUp = 0;
    supplierStats.forEach((g) => {
      totalSuppliers += g._count;
      if (g.status === 'INACTIVE') suppliersNeedFollowUp += g._count;
    });
    const outstandingSuppliers = await prisma.pharmacySupplier.count({
      where: { outstandingAmount: { gt: 0 } },
    });
    suppliersNeedFollowUp += outstandingSuppliers;

    const kpis = {
      todaySales,
      salesChangePct,
      salesChangeLabel:
        salesChangePct > 0
          ? `↑ ${salesChangePct}% from yesterday`
          : salesChangePct < 0
            ? `↓ ${Math.abs(salesChangePct)}% from yesterday`
            : yesterdaySales === 0 && todaySales === 0
              ? 'No sales yesterday'
              : 'Same as yesterday',
      pendingPrescriptions: pendingQueueCount,
      lowStockCount,
      suppliersCount: totalSuppliers,
      suppliersNeedFollowUp,
    };

    const pendingPrescriptions = queueRows.map((row) => ({
      id: row.id,
      tokenNumber: row.tokenNumber,
      patientName: row.patient?.name || '—',
      doctorName: row.doctor?.user?.name || '—',
      medicineCount: row.items?.length || 0,
      time: formatTime(row.sentAt),
    }));

    const recentBills = recentBillsRaw.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      patientName: b.patientName || b.customerName || '—',
      type: b.billingType === 'WALK_IN' ? 'Walk-in' : 'Hospital',
      amount: roundMoney(Number(b.grandTotal)),
      status: billStatusLabel(b.status),
      statusKey: b.status,
      time: formatTime(b.createdAt),
    }));

    const suppliers = suppliersRaw.map((s) => ({
      id: s.id,
      name: s.supplierName,
      status: supplierStatusLabel(s),
      statusKey: supplierStatusLabel(s).toLowerCase(),
    }));

    return res.json({
      kpis,
      salesChart,
      billingDistribution,
      distributionTotal,
      pendingPrescriptions,
      recentBills,
      lowStock: lowStockRows,
      suppliers,
    });
  } catch (err) {
    console.error('[pharmacy/dashboard]', err);
    return res.status(500).json({ message: 'Failed to load pharmacy dashboard' });
  }
};

module.exports = { getDashboard };
