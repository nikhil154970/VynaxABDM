require('dotenv').config();
const { prisma } = require('../src/config/prisma');

async function main() {
  try {
    const items = await prisma.recoveryRecord.findMany({
      where: {
        transferRequestStatus: 'PENDING',
        status: 'READY_FOR_TRANSFER',
      },
      orderBy: { transferRequestedAt: 'asc' },
      include: {
        surgerySession: {
          include: {
            surgerySchedule: {
              include: {
                otRequest: {
                  include: {
                    patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, mobile: true } },
                    admission: {
                      select: {
                        id: true,
                        ipdNumber: true,
                        bedNumber: true,
                        ward: { select: { id: true, name: true } },
                        bed: { select: { id: true, code: true } },
                      },
                    },
                  },
                },
                otRoom: { select: { roomName: true, roomNumber: true } },
                surgeon: { select: { user: { select: { name: true } } } },
              },
            },
            postSurgeryNote: { select: { surgeryOutcome: true, procedureSummary: true } },
          },
        },
        assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    console.log('OK', items.length);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
