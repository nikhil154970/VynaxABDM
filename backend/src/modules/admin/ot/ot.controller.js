const { prisma } = require('../../../config/prisma');

// ──────── OT ROOMS ────────

async function listOtRooms(req, res) {
  try {
    const { search, active } = req.query;
    const where = {};
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;
    if (search) where.OR = [
      { roomNumber: { contains: String(search), mode: 'insensitive' } },
      { roomName: { contains: String(search), mode: 'insensitive' } },
    ];

    const items = await prisma.otRoom.findMany({
      where,
      orderBy: { roomNumber: 'asc' },
      include: { _count: { select: { surgerySchedules: true } } },
    });
    return res.json({ items });
  } catch (err) {
    console.error('listOtRooms error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createOtRoom(req, res) {
  try {
    const { roomNumber, roomName, floor } = req.body;
    if (!roomNumber || !roomName) return res.status(400).json({ message: 'Room number and name are required' });

    const existing = await prisma.otRoom.findUnique({ where: { roomNumber } });
    if (existing) return res.status(409).json({ message: 'Room with this number already exists' });

    const room = await prisma.otRoom.create({
      data: { roomNumber: String(roomNumber).trim(), roomName: String(roomName).trim(), floor: floor || null },
    });
    return res.status(201).json({ ok: true, room });
  } catch (err) {
    console.error('createOtRoom error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateOtRoom(req, res) {
  try {
    const { id } = req.params;
    const { roomNumber, roomName, floor, isActive } = req.body;

    const room = await prisma.otRoom.findUnique({ where: { id } });
    if (!room) return res.status(404).json({ message: 'OT Room not found' });

    const data = {};
    if (roomNumber !== undefined) data.roomNumber = String(roomNumber).trim();
    if (roomName !== undefined) data.roomName = String(roomName).trim();
    if (floor !== undefined) data.floor = floor;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (data.roomNumber && data.roomNumber !== room.roomNumber) {
      const dup = await prisma.otRoom.findUnique({ where: { roomNumber: data.roomNumber } });
      if (dup) return res.status(409).json({ message: 'Room with this number already exists' });
    }

    const updated = await prisma.otRoom.update({ where: { id }, data });
    return res.json({ ok: true, room: updated });
  } catch (err) {
    console.error('updateOtRoom error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteOtRoom(req, res) {
  try {
    const { id } = req.params;
    const room = await prisma.otRoom.findUnique({ where: { id }, include: { _count: { select: { surgerySchedules: true } } } });
    if (!room) return res.status(404).json({ message: 'OT Room not found' });
    if (room._count.surgerySchedules > 0) return res.status(400).json({ message: 'Cannot delete room with scheduled surgeries. Deactivate it instead.' });

    await prisma.otRoom.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('deleteOtRoom error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ──────── OT NURSES ────────

async function listOtNurses(req, res) {
  try {
    const nurses = await prisma.user.findMany({
      where: { role: 'NURSE' },
      select: { id: true, name: true, email: true, employeeId: true, phone: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ items: nurses });
  } catch (err) {
    console.error('listOtNurses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function toggleNurseActive(req, res) {
  try {
    const { id } = req.params;
    const nurse = await prisma.user.findUnique({ where: { id } });
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });
    if (nurse.role !== 'NURSE') return res.status(400).json({ message: 'User is not a nurse' });

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !nurse.isActive },
      select: { id: true, name: true, isActive: true },
    });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('toggleNurseActive error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listOtRooms, createOtRoom, updateOtRoom, deleteOtRoom, listOtNurses, toggleNurseActive };
