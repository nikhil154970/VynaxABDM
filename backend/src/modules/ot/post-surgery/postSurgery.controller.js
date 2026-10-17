const { prisma } = require('../../../config/prisma');

// ─── Get Post Surgery Notes ───

async function getPostSurgeryNotes(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await prisma.surgerySession.findUnique({
      where: { id: sessionId },
      include: {
        surgerySchedule: {
          include: {
            otRequest: {
              include: {
                patient: { select: { id: true, name: true, uhid: true, age: true, gender: true } },
                admission: { select: { ipdNumber: true, bedNumber: true } },
              },
            },
            otRoom: { select: { roomNumber: true, roomName: true } },
            surgeon: { select: { id: true, user: { select: { name: true } } } },
          },
        },
        recoveryRecord: {
          include: {
            assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
            transfers: { orderBy: { createdAt: 'desc' } },
          },
        },
        postSurgeryNote: true,
      },
    });

    if (!session) return res.status(404).json({ message: 'Surgery session not found' });
    return res.json({ session });
  } catch (err) {
    console.error('getPostSurgeryNotes error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Save/Update Post Surgery Notes ───

async function savePostSurgeryNotes(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { sessionId } = req.params;
    const body = req.body;

    const existing = await prisma.postSurgeryNote.findUnique({ where: { surgerySessionId: sessionId } });

    let note;
    if (existing) {
      const oldValues = {};
      const changedFields = [];
      const trackedFields = ['surgeryOutcome', 'procedureSummary', 'operationFindings', 'surgeonNotes', 'complications', 'bloodLoss', 'specialInstructions', 'followUpInstructions', 'medicines', 'dischargeRecommendation'];

      for (const field of trackedFields) {
        if (body[field] !== undefined && body[field] !== existing[field]) {
          oldValues[field] = existing[field];
          changedFields.push(field);
        }
      }

      note = await prisma.postSurgeryNote.update({
        where: { surgerySessionId: sessionId },
        data: {
          surgeryOutcome: body.surgeryOutcome !== undefined ? body.surgeryOutcome : undefined,
          procedureSummary: body.procedureSummary !== undefined ? body.procedureSummary : undefined,
          operationFindings: body.operationFindings !== undefined ? body.operationFindings : undefined,
          surgeonNotes: body.surgeonNotes !== undefined ? body.surgeonNotes : undefined,
          complications: body.complications !== undefined ? body.complications : undefined,
          bloodLoss: body.bloodLoss !== undefined ? body.bloodLoss : undefined,
          specialInstructions: body.specialInstructions !== undefined ? body.specialInstructions : undefined,
          followUpInstructions: body.followUpInstructions !== undefined ? body.followUpInstructions : undefined,
          medicines: body.medicines !== undefined ? body.medicines : undefined,
          dischargeRecommendation: body.dischargeRecommendation !== undefined ? body.dischargeRecommendation : undefined,
        },
      });

      // Create audit trail entries for changed fields
      for (const field of changedFields) {
        await prisma.surgeryAuditTrail.create({
          data: {
            surgerySessionId: sessionId,
            fieldChanged: field,
            oldValue: String(oldValues[field] ?? ''),
            newValue: String(body[field] ?? ''),
            changedBy: userId,
          },
        });
      }
    } else {
      note = await prisma.postSurgeryNote.create({
        data: {
          surgerySessionId: sessionId,
          surgeryOutcome: body.surgeryOutcome || null,
          procedureSummary: body.procedureSummary || null,
          operationFindings: body.operationFindings || null,
          surgeonNotes: body.surgeonNotes || null,
          complications: body.complications || null,
          bloodLoss: body.bloodLoss || null,
          specialInstructions: body.specialInstructions || null,
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

// ─── Add Follow-Up Entry ───

async function addFollowUp(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { sessionId } = req.params;
    const { doctorNotes } = req.body;

    const note = await prisma.postSurgeryNote.findUnique({ where: { surgerySessionId: sessionId } });
    if (!note) return res.status(404).json({ message: 'Post surgery notes not found. Save notes first.' });

    const entry = await prisma.followUpHistory.create({
      data: {
        postSurgeryNoteId: note.id,
        doctorNotes: doctorNotes || null,
        createdBy: userId,
      },
    });

    return res.json({ ok: true, followUp: entry });
  } catch (err) {
    console.error('addFollowUp error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

// ─── Get Follow-Up History ───

async function getFollowUpHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const note = await prisma.postSurgeryNote.findUnique({
      where: { surgerySessionId: sessionId },
      select: { id: true },
    });
    if (!note) return res.json({ followUps: [] });

    const followUps = await prisma.followUpHistory.findMany({
      where: { postSurgeryNoteId: note.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ followUps });
  } catch (err) {
    console.error('getFollowUpHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Add Complication ───

async function addComplication(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { sessionId } = req.params;
    const { complicationType, severity, description, actionTaken } = req.body;

    if (!complicationType || !severity) {
      return res.status(400).json({ message: 'Complication type and severity are required' });
    }

    const note = await prisma.postSurgeryNote.findUnique({ where: { surgerySessionId: sessionId } });
    if (!note) return res.status(404).json({ message: 'Post surgery notes not found. Save notes first.' });

    const complication = await prisma.complicationTracking.create({
      data: {
        postSurgeryNoteId: note.id,
        complicationType,
        severity,
        description: description || null,
        actionTaken: actionTaken || null,
        createdBy: userId,
      },
    });

    // Audit trail for complication
    await prisma.surgeryAuditTrail.create({
      data: {
        surgerySessionId: sessionId,
        fieldChanged: 'complication.' + complicationType,
        oldValue: '',
        newValue: severity + ': ' + (description || ''),
        changedBy: userId,
      },
    });

    // Timeline for complication
    const rr = await prisma.recoveryRecord.findUnique({ where: { surgerySessionId: sessionId } });
    if (rr) {
      await prisma.recoveryTimeline.create({
        data: {
          recoveryRecordId: rr.id,
          eventType: 'COMPLICATION',
          eventDescription: 'Complication: ' + complicationType + ' (' + severity + ')',
          createdBy: userId,
        },
      });
    }

    return res.json({ ok: true, complication });
  } catch (err) {
    console.error('addComplication error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

// ─── Get Complication History ───

async function getComplicationHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const note = await prisma.postSurgeryNote.findUnique({
      where: { surgerySessionId: sessionId },
      select: { id: true },
    });
    if (!note) return res.json({ complications: [] });

    const complications = await prisma.complicationTracking.findMany({
      where: { postSurgeryNoteId: note.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ complications });
  } catch (err) {
    console.error('getComplicationHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Get Audit Trail ───

async function getAuditTrail(req, res) {
  try {
    const { sessionId } = req.params;
    const trails = await prisma.surgeryAuditTrail.findMany({
      where: { surgerySessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ trails });
  } catch (err) {
    console.error('getAuditTrail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getPostSurgeryNotes,
  savePostSurgeryNotes,
  addFollowUp,
  getFollowUpHistory,
  addComplication,
  getComplicationHistory,
  getAuditTrail,
};
