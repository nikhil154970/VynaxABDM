async function restoreStockFromBill(tx, bill) {
  const items = await tx.pharmacyBillItem.findMany({ where: { billId: bill.id } });
  for (const item of items) {
    const batch = await tx.pharmacyInventoryBatch.findUnique({
      where: { id: item.inventoryBatchId },
      select: { id: true, availableQty: true, medicineId: true },
    });
    if (!batch) continue;
    const newBalance = batch.availableQty + item.quantity;
    await tx.pharmacyInventoryBatch.update({
      where: { id: batch.id },
      data: { availableQty: newBalance, status: 'ACTIVE' },
    });
    await tx.pharmacyStockTransaction.create({
      data: {
        medicineId: item.medicineId,
        batchId: batch.id,
        type: 'BILL_CANCELLED',
        qtyIn: item.quantity,
        qtyOut: 0,
        balance: newBalance,
        referenceType: 'PHARMACY_BILL',
        referenceId: bill.id,
        notes: `Bill cancelled — ${bill.billNumber} — batch ${item.batchNumber}`,
      },
    });
  }
}

function stockWasDeducted(status) {
  return ['PAID', 'PARTIALLY_PAID', 'PENDING_PAYMENT'].includes(status);
}

module.exports = {
  restoreStockFromBill,
  stockWasDeducted,
};
