const { prisma, isDbDisconnectError, withDbRetry } = require('../../../config/prisma');

async function autoReleaseCleaningRooms() {
  try {
    await withDbRetry(async () => {
      const now = new Date();
      const result = await prisma.otRoom.updateMany({
        where: { status: 'CLEANING', expectedAvailableAt: { lte: now } },
        data: { status: 'AVAILABLE', expectedAvailableAt: null },
      });
      if (result.count > 0) {
        console.log(`[OtRoom] Auto-released ${result.count} room(s) to AVAILABLE`);
      }
    });
  } catch (err) {
    if (!isDbDisconnectError(err)) {
      console.warn('[OtRoom] auto-release skipped:', err?.message || err);
    }
  }
}

async function autoReturnEquipment() {
  try {
    await withDbRetry(async () => {
      const now = new Date();
      const due = await prisma.equipmentAllocation.findMany({
        where: { returnedAt: null, expectedReturnAt: { lte: now } },
      });
      if (due.length === 0) return;

      for (const alloc of due) {
        await prisma.$transaction([
          prisma.equipmentAllocation.update({
            where: { id: alloc.id },
            data: { returnedAt: now },
          }),
          prisma.equipmentInventory.update({
            where: { id: alloc.equipmentId },
            data: { availableQuantity: { increment: alloc.quantityAllocated } },
          }),
        ]);
      }
      console.log(`[Equipment] Auto-returned ${due.length} allocation(s)`);
    });
  } catch (err) {
    if (!isDbDisconnectError(err)) {
      console.warn('[Equipment] auto-return skipped:', err?.message || err);
    }
  }
}

module.exports = { autoReleaseCleaningRooms, autoReturnEquipment };
