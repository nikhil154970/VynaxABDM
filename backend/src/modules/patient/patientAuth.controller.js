const bcrypt = require('bcrypt');
const { prisma } = require('../../config/prisma');
const { generateAccessToken } = require('../../config/jwt');

const SALT_ROUNDS = 12;
const PATIENT_TOKEN_EXPIRY = '24h';

async function findPatientByLoginId(identifier) {
  const id = String(identifier || '').trim();
  if (!id) return null;

  const include = { patientAuth: true };

  let patient = await prisma.patient.findUnique({ where: { uhid: id }, include });
  if (patient) return patient;

  patient = await prisma.patient.findUnique({ where: { registrationNumber: id }, include });
  if (patient) return patient;

  patient = await prisma.patient.findFirst({
    where: { uhid: { equals: id, mode: 'insensitive' } },
    include,
  });
  if (patient) return patient;

  if (/^\d{10}$/.test(id)) {
    patient = await prisma.patient.findFirst({ where: { mobile: id }, include });
  }
  return patient;
}

exports.login = async (req, res) => {
  try {
    const uhid = (req.body.uhid || '').trim();
    const password = req.body.password || '';
    if (!uhid || !password) return res.status(400).json({ message: 'UHID and password are required' });

    const patient = await findPatientByLoginId(uhid);
    if (!patient) {
      console.log(`[PATIENT LOGIN] No patient found for identifier: "${uhid}"`);
      return res.status(404).json({ message: 'Patient not found. Use your UHID (e.g. UH20260618...) or REG number.' });
    }

    const auth = patient.patientAuth;
    if (!auth) {
      console.log(`[PATIENT LOGIN] No patientAuth for patient ${patient.id} (${patient.name}), UHID: ${uhid}`);
      return res.status(401).json({ message: 'Patient portal not enabled. Contact reception.' });
    }
    if (!auth.isActive) return res.status(403).json({ message: 'Portal access is disabled' });

    const valid = await bcrypt.compare(password, auth.password);
    if (!valid) {
      console.log(`[PATIENT LOGIN] Invalid password for patient ${patient.id} (${patient.name}), pw len sent: ${password.length}, stored hash prefix: ${auth.password.substring(0, 10)}...`);
      return res.status(401).json({ message: 'Invalid password' });
    }

    await prisma.patientAuth.update({
      where: { patientId: patient.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateAccessToken(
      { patientId: patient.id, uhid: patient.uhid, role: 'PATIENT' },
      PATIENT_TOKEN_EXPIRY
    );

    return res.json({
      accessToken: token,
      patient: {
        id: patient.id,
        name: patient.name,
        uhid: patient.uhid,
        mobile: patient.mobile,
        gender: patient.gender,
        age: patient.age,
        registrationNumber: patient.registrationNumber,
      },
    });
  } catch (err) {
    console.error('Patient login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, mobile, dob, age, gender, address, bloodGroup, allergies, heightCm, weightKg, emergencyName, emergencyPhone, emergencyRelation, aadhaarId } = req.body;
    const password = req.body.password || '';

    if (!name || !gender || !password) return res.status(400).json({ message: 'Name, gender, and password are required' });
    if (!mobile && !aadhaarId) return res.status(400).json({ message: 'Mobile or Aadhaar is required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const uhid = await generateUniqueUHID();
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          name,
          uhid,
          age: age ? parseInt(age) : null,
          gender,
          mobile: mobile || null,
          registrationSource: 'SELF',
          dob: dob ? new Date(dob) : null,
          aadhaarId: aadhaarId || null,
          address: address || null,
          bloodGroup: bloodGroup || null,
          allergies: allergies || null,
          heightCm: heightCm ? parseInt(heightCm) : null,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          emergencyName: emergencyName || null,
          emergencyPhone: emergencyPhone || null,
          emergencyRelation: emergencyRelation || null,
          registrationNumber: null,
        },
      });

      const seq = patient.regSeq;
      const regNum = `REG-${String(seq).padStart(3, '0')}`;
      await tx.patient.update({ where: { id: patient.id }, data: { registrationNumber: regNum } });

      await tx.patientAuth.create({
        data: { patientId: patient.id, password: hashed, lastLoginAt: new Date() },
      });

      await tx.receptionVisit.create({
        data: {
          patientId: patient.id,
          visitType: 'OPD',
          status: 'WAITING',
          visitDate: new Date(),
        },
      });

      return { ...patient, registrationNumber: regNum };
    });

    const token = generateAccessToken(
      { patientId: result.id, uhid: result.uhid, role: 'PATIENT' },
      PATIENT_TOKEN_EXPIRY
    );

    return res.status(201).json({
      message: 'Registration successful',
      accessToken: token,
      patient: {
        id: result.id,
        name: result.name,
        uhid: result.uhid,
        mobile: result.mobile,
        registrationNumber: result.registrationNumber,
      },
    });
  } catch (err) {
    console.error('Patient registration error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.enablePortal = async (req, res) => {
  try {
    const uhid = (req.body.uhid || '').trim();
    const password = req.body.password || '';
    if (!uhid || !password) return res.status(400).json({ message: 'UHID and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const patient = await prisma.patient.findUnique({ where: { uhid } });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const existing = await prisma.patientAuth.findUnique({ where: { patientId: patient.id } });
    if (existing) return res.status(409).json({ message: 'Portal access already enabled' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.patientAuth.create({ data: { patientId: patient.id, password: hashed } });

    return res.json({ message: 'Portal access enabled for patient', uhid });
  } catch (err) {
    console.error('Enable portal error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const patientId = req.user.patientId;
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        _count: { select: { appointments: true, admissions: true, bills: true, labOrders: true, otRequests: true } },
      },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    return res.json({ patient });
  } catch (err) {
    console.error('Patient profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getMyVisits = async (req, res) => {
  try {
    const patientId = req.user.patientId;
    const visits = await prisma.receptionVisit.findMany({
      where: { patientId },
      orderBy: { visitDate: 'desc' },
      take: 20,
    });
    return res.json({ visits });
  } catch (err) {
    console.error('Patient visits error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getMyBills = async (req, res) => {
  try {
    const patientId = req.user.patientId;
    const bills = await prisma.bill.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ bills });
  } catch (err) {
    console.error('Patient bills error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

async function generateUniqueUHID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  for (let i = 0; i < 10; i += 1) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const uhid = `UH${y}${m}${d}${rand}`;
    const exists = await prisma.patient.findUnique({ where: { uhid }, select: { id: true } });
    if (!exists) return uhid;
  }
  throw new Error('Failed to generate UHID');
}
