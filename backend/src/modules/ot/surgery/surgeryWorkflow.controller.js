const { prisma } = require('../../../config/prisma');
const { autoReleaseCleaningRooms } = require('./roomHelper');
async function listEquipment(req, res) {
  try {
    const { category, search } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;
    if (search) where.equipmentName = { contains: search, mode: 'insensitive' };
    const items = await prisma.equipmentInventory.findMany({ where, orderBy: { equipmentName: 'asc' } });
    return res.json({ items });
  } catch (err) {
    console.error('listEquipment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function addEquipment(req, res) {
  try {
    const { equipmentName, category, totalQuantity, availableQuantity, serialNumber, maintenanceDate, remarks } = req.body;
    if (!equipmentName || !category) return res.status(400).json({ message: 'Equipment name and category are required' });
    const item = await prisma.equipmentInventory.create({
      data: {
        equipmentName,
        category,
        totalQuantity: parseInt(totalQuantity, 10) || 0,
        availableQuantity: availableQuantity != null ? parseInt(availableQuantity, 10) : (parseInt(totalQuantity, 10) || 0),
        serialNumber: serialNumber || null,
        maintenanceDate: maintenanceDate ? new Date(maintenanceDate) : null,
        remarks: remarks || null,
      },
    });
    return res.status(201).json({ item });
  } catch (err) {
    console.error('addEquipment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateEquipment(req, res) {
  try {
    const { id } = req.params;
    const { equipmentName, category, totalQuantity, availableQuantity, serialNumber, maintenanceDate, remarks } = req.body;
    const data = {};
    if (equipmentName !== undefined) data.equipmentName = equipmentName;
    if (category !== undefined) data.category = category;
    if (totalQuantity !== undefined) data.totalQuantity = parseInt(totalQuantity, 10);
    if (availableQuantity !== undefined) data.availableQuantity = parseInt(availableQuantity, 10);
    if (serialNumber !== undefined) data.serialNumber = serialNumber || null;
    if (maintenanceDate !== undefined) data.maintenanceDate = maintenanceDate ? new Date(maintenanceDate) : null;
    if (remarks !== undefined) data.remarks = remarks || null;
    const item = await prisma.equipmentInventory.update({ where: { id }, data });
    return res.json({ item });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Equipment not found' });
    console.error('updateEquipment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteEquipment(req, res) {
  try {
    const { id } = req.params;
    await prisma.equipmentInventory.update({ where: { id }, data: { isActive: false } });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Equipment not found' });
    console.error('deleteEquipment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function allocateEquipment(req, res) {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ message: 'Valid quantity is required' });

    const equip = await prisma.equipmentInventory.findUnique({ where: { id } });
    if (!equip) return res.status(404).json({ message: 'Equipment not found' });
    if (quantity > equip.availableQuantity) {
      return res.status(400).json({ message: `Not enough ${equip.equipmentName}. Available: ${equip.availableQuantity}, requested: ${quantity}` });
    }

    const updated = await prisma.equipmentInventory.update({
      where: { id },
      data: { availableQuantity: { decrement: quantity } },
    });

    return res.json({ item: updated, message: `Allocated ${quantity} x ${equip.equipmentName}` });
  } catch (err) {
    console.error('allocateEquipment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getEquipmentHistory(req, res) {
  try {
    const { id } = req.params;
    const allocations = await prisma.equipmentAllocation.findMany({
      where: { equipmentId: id },
      include: {
        surgerySession: {
          include: {
            surgerySchedule: {
              include: {
                otRequest: { include: { patient: { select: { name: true, uhid: true } } } },
                otRoom: { select: { roomNumber: true, roomName: true } },
              },
            },
          },
        },
      },
      orderBy: { allocatedAt: 'desc' },
      take: 50,
    });
    return res.json({ items: allocations });
  } catch (err) {
    console.error('getEquipmentHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Consumable CRUD ───

async function listConsumables(req, res) {
  try {
    let items = await prisma.consumableInventory.findMany({ where: { isActive: true }, orderBy: { consumableName: 'asc' } });
    if (items.length === 0) {
      // Auto-seed default surgical consumables list if database table is empty
      const defaults = [
        { consumableName: 'Surgical Gloves (Size 7.5)', category: 'OT Supplies', totalQuantity: 200, availableQuantity: 200, unit: 'pairs' },
        { consumableName: 'Surgical Mask (Disposable)', category: 'OT Supplies', totalQuantity: 500, availableQuantity: 500, unit: 'pieces' },
        { consumableName: 'Disposable Syringe (5ml)', category: 'OT Supplies', totalQuantity: 300, availableQuantity: 300, unit: 'pieces' },
        { consumableName: 'Disposable Syringe (10ml)', category: 'OT Supplies', totalQuantity: 200, availableQuantity: 200, unit: 'pieces' },
        { consumableName: 'Scalpel Blade (No. 11)', category: 'OT Instruments', totalQuantity: 100, availableQuantity: 100, unit: 'pieces' },
        { consumableName: 'Surgical Gown (Sterile)', category: 'Apparel', totalQuantity: 80, availableQuantity: 80, unit: 'pieces' },
        { consumableName: 'Adhesive Tape (3 inch)', category: 'OT Supplies', totalQuantity: 60, availableQuantity: 60, unit: 'rolls' },
        { consumableName: 'Gauze Swab (10x10 cm)', category: 'OT Supplies', totalQuantity: 150, availableQuantity: 150, unit: 'packets' },
        { consumableName: 'Surgical Suture (2-0)', category: 'OT Supplies', totalQuantity: 120, availableQuantity: 120, unit: 'pieces' },
        { consumableName: 'IV Cannula (G20)', category: 'OT Supplies', totalQuantity: 150, availableQuantity: 150, unit: 'pieces' },
        { consumableName: 'Cotton Roll (500g)', category: 'OT Supplies', totalQuantity: 40, availableQuantity: 40, unit: 'rolls' },
      ];
      await prisma.consumableInventory.createMany({ data: defaults });
      items = await prisma.consumableInventory.findMany({ where: { isActive: true }, orderBy: { consumableName: 'asc' } });
    }
    return res.json({ items });
  } catch (err) {
    console.error('listConsumables error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Start Surgery with Equipment Allocation ───

async function startSurgeryWithAllocation(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { scheduleId, equipmentAllocations, consumableUsages } = req.body;
    if (!scheduleId) return res.status(400).json({ message: 'Schedule ID is required' });

    const schedule = await prisma.surgerySchedule.findUnique({
      where: { id: scheduleId },
      include: { surgerySession: true, otRequest: { select: { id: true } } },
    });
    if (!schedule) return res.status(404).json({ message: 'Surgery schedule not found' });

    if (schedule.surgerySession) {
      const sess = schedule.surgerySession;
      if (sess.status === 'IN_PROGRESS') {
        await prisma.$transaction(async (tx) => {
          if (schedule.status !== 'IN_PROGRESS') {
            await tx.surgerySchedule.update({ where: { id: scheduleId }, data: { status: 'IN_PROGRESS' } });
          }
          const ot = await tx.otRequest.findUnique({ where: { id: schedule.otRequest.id }, select: { status: true } });
          if (ot?.status !== 'IN_PROGRESS') {
            await tx.otRequest.update({
              where: { id: schedule.otRequest.id },
              data: { status: 'IN_PROGRESS', statusHistory: { create: { status: 'IN_PROGRESS', changedBy: userId } } },
            });
          }
          // Ensure room is OCCUPIED even on re-entry
          if (schedule.otRoomId) {
            await tx.otRoom.update({
              where: { id: schedule.otRoomId },
              data: { status: 'OCCUPIED', occupiedSince: new Date(), expectedAvailableAt: null },
            });
          }
        });
        return res.json({ ok: true, session: sess, alreadyStarted: true });
      }
      const msg = sess.status === 'RECOVERY' ? 'Surgery already in recovery' : 'Surgery already completed';
      return res.status(409).json({ message: msg });
    }

    // Validate equipment quantities
    if (Array.isArray(equipmentAllocations)) {
      for (const ea of equipmentAllocations) {
        const equip = await prisma.equipmentInventory.findUnique({ where: { id: ea.equipmentId } });
        if (!equip) return res.status(404).json({ message: `Equipment ${ea.equipmentId} not found` });
        if (ea.quantityAllocated > equip.availableQuantity) {
          return res.status(400).json({ message: `Not enough ${equip.equipmentName}. Available: ${equip.availableQuantity}, requested: ${ea.quantityAllocated}` });
        }
      }
    }

    // Validate consumable quantities
    if (Array.isArray(consumableUsages)) {
      for (const cu of consumableUsages) {
        const con = await prisma.consumableInventory.findUnique({ where: { id: cu.consumableId } });
        if (!con) return res.status(404).json({ message: `Consumable ${cu.consumableId} not found` });
        if (cu.quantityUsed > con.availableQuantity) {
          return res.status(400).json({ message: `Not enough ${con.consumableName}. Available: ${con.availableQuantity}, requested: ${cu.quantityUsed}` });
        }
      }
    }

    const session = await prisma.$transaction(async (tx) => {
      // Create surgery session
      const sess = await tx.surgerySession.create({
        data: {
          surgeryScheduleId: scheduleId,
          startTime: new Date(),
          status: 'IN_PROGRESS',
        },
      });

      // Allocate equipment
      if (Array.isArray(equipmentAllocations)) {
        for (const ea of equipmentAllocations) {
          await tx.equipmentAllocation.create({
            data: {
              surgerySessionId: sess.id,
              equipmentId: ea.equipmentId,
              quantityAllocated: ea.quantityAllocated,
            },
          });
          await tx.equipmentInventory.update({
            where: { id: ea.equipmentId },
            data: { availableQuantity: { decrement: ea.quantityAllocated } },
          });
        }
      }

      // Use consumables
      if (Array.isArray(consumableUsages)) {
        for (const cu of consumableUsages) {
          await tx.consumableUsage.create({
            data: {
              surgerySessionId: sess.id,
              consumableId: cu.consumableId,
              quantityUsed: cu.quantityUsed,
            },
          });
          await tx.consumableInventory.update({
            where: { id: cu.consumableId },
            data: { availableQuantity: { decrement: cu.quantityUsed } },
          });
        }
      }

      // Update schedule + ot request status
      const updatedSchedule = await tx.surgerySchedule.update({
        where: { id: scheduleId },
        data: { status: 'IN_PROGRESS' },
      });
      await tx.otRequest.update({
        where: { id: schedule.otRequest.id },
        data: {
          status: 'IN_PROGRESS',
          statusHistory: { create: { status: 'IN_PROGRESS', changedBy: userId } },
        },
      });
      // Set room to OCCUPIED
      if (updatedSchedule.otRoomId) {
        await tx.otRoom.update({
          where: { id: updatedSchedule.otRoomId },
          data: { status: 'OCCUPIED', occupiedSince: new Date(), expectedAvailableAt: null },
        });
      }

      return sess;
    }, { maxWait: 15000, timeout: 30000 });

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId, action: 'START_SURGERY_WITH_ALLOCATION', module: 'OT' });
    } catch { /* best-effort */ }

    try {
      const scheduleWithSurgeon = await prisma.surgerySchedule.findUnique({
        where: { id: scheduleId },
        select: {
          otRequest: { select: { uhid: true, patient: { select: { name: true } } } },
          surgeon: { select: { user: { select: { id: true } } } },
        },
      });
      const surgeonUserId = scheduleWithSurgeon?.surgeon?.user?.id;
      if (surgeonUserId) {
        await prisma.notification.create({
          data: {
            userId: surgeonUserId,
            type: 'UPDATE',
            severity: 'INFO',
            title: 'Surgery Started',
            message: `OT has started surgery for ${scheduleWithSurgeon.otRequest?.patient?.name || 'patient'} (${scheduleWithSurgeon.otRequest?.uhid || ''}). Submit Surgery Report when complete.`,
          },
        });
      }
    } catch { /* best-effort */ }

    return res.status(201).json({ ok: true, session });
  } catch (err) {
    console.error('startSurgeryWithAllocation error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

// ─── Post Surgery Notes ───

async function savePostSurgeryNotes(req, res) {
  try {
    const { sessionId } = req.params;
    const body = req.body;
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' });

    const session = await prisma.surgerySession.findUnique({ where: { id: sessionId }, include: { postSurgeryNote: true } });
    if (!session) return res.status(404).json({ message: 'Surgery session not found' });

    let note;
    if (session.postSurgeryNote) {
      note = await prisma.postSurgeryNote.update({
        where: { surgerySessionId: sessionId },
        data: {
          surgeryOutcome: body.surgeryOutcome !== undefined ? body.surgeryOutcome : undefined,
          procedureSummary: body.procedureSummary !== undefined ? body.procedureSummary : undefined,
          surgeonNotes: body.surgeonNotes !== undefined ? body.surgeonNotes : undefined,
          complications: body.complications !== undefined ? body.complications : undefined,
          followUpInstructions: body.followUpInstructions !== undefined ? body.followUpInstructions : undefined,
          medicines: body.medicines !== undefined ? body.medicines : undefined,
          dischargeRecommendation: body.dischargeRecommendation !== undefined ? body.dischargeRecommendation : undefined,
        },
      });
    } else {
      note = await prisma.postSurgeryNote.create({
        data: {
          surgerySessionId: sessionId,
          surgeryOutcome: body.surgeryOutcome || null,
          procedureSummary: body.procedureSummary || null,
          surgeonNotes: body.surgeonNotes || null,
          complications: body.complications || null,
          followUpInstructions: body.followUpInstructions || null,
          medicines: body.medicines || null,
          dischargeRecommendation: body.dischargeRecommendation || null,
        },
      });
    }
    return res.json({ ok: true, postSurgeryNote: note });
  } catch (err) {
    console.error('savePostSurgeryNotes error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

// ─── Get Surgery Session Details ───

async function getSurgerySession(req, res) {
  try {
    const { id } = req.params;
    const session = await prisma.surgerySession.findUnique({
      where: { id },
      include: {
        surgerySchedule: {
          include: {
            otRequest: { include: { patient: { select: { name: true, uhid: true } }, preOperativeAssessment: { include: { assessedBy: { select: { name: true } } } } } },
            otRoom: { select: { roomNumber: true, roomName: true } },
            surgeon: { select: { id: true, user: { select: { name: true } } } },
            assistantSurgeon: { select: { id: true, user: { select: { name: true } } } },
            otNurse: { select: { id: true, name: true } },
            anaesthetist: { select: { id: true, user: { select: { name: true } } } },
          },
        },
        equipmentAllocations: { include: { equipment: { select: { equipmentName: true, category: true } } } },
        consumableUsages: { include: { consumable: { select: { consumableName: true, unit: true } } } },
        recoveryRecord: true,
        postSurgeryNote: true,
      },
    });
    if (!session) return res.status(404).json({ message: 'Surgery session not found' });
    return res.json({ session });
  } catch (err) {
    console.error('getSurgerySession error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── In Progress List with Equipment ───

async function listInProgressSurgeries(req, res) {
  try {
    const items = await prisma.surgerySession.findMany({
      where: { status: 'IN_PROGRESS' },
      orderBy: { startTime: 'desc' },
      include: {
        surgerySchedule: {
          include: {
            otRequest: { include: { patient: { select: { id: true, name: true, uhid: true } } } },
            otRoom: { select: { roomNumber: true, roomName: true } },
            surgeon: { select: { user: { select: { name: true } } } },
          },
        },
        equipmentAllocations: { include: { equipment: { select: { equipmentName: true } } } },
        recoveryRecord: true,
      },
    });
    return res.json({ items });
  } catch (err) {
    console.error('listInProgressSurgeries error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Recovery Room List ───

async function listRecoveryPatients(req, res) {
  try {
    const items = await prisma.surgerySession.findMany({
      where: { status: 'RECOVERY', recoveryRecord: { isNot: null } },
      orderBy: { recoveryRecord: { admittedAt: 'desc' } },
      include: {
        surgerySchedule: {
          include: {
            otRequest: { include: { patient: { select: { name: true, uhid: true } } } },
            otRoom: { select: { roomNumber: true, roomName: true } },
            surgeon: { select: { user: { select: { name: true } } } },
          },
        },
        recoveryRecord: true,
      },
    });
    return res.json({ items });
  } catch (err) {
    console.error('listRecoveryPatients error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Post Surgery List (recovery but can have notes) ───

async function listPostSurgeryPatients(req, res) {
  try {
    const items = await prisma.surgerySession.findMany({
      where: { status: { in: ['RECOVERY', 'COMPLETED'] } },
      orderBy: { updatedAt: 'desc' },
      include: {
        surgerySchedule: {
          include: {
            otRequest: { include: { patient: { select: { name: true, uhid: true } } } },
            otRoom: { select: { roomNumber: true, roomName: true } },
            surgeon: { select: { user: { select: { name: true } } } },
          },
        },
        recoveryRecord: true,
        postSurgeryNote: true,
      },
    });
    return res.json({ items });
  } catch (err) {
    console.error('listPostSurgeryPatients error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listEquipment, addEquipment, updateEquipment, deleteEquipment, getEquipmentHistory, allocateEquipment,
  listConsumables,
  startSurgeryWithAllocation, savePostSurgeryNotes,
  getSurgerySession, listInProgressSurgeries, listRecoveryPatients, listPostSurgeryPatients,
};
