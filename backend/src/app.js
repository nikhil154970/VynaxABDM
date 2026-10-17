const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const logsRoutes = require('./routes/logs.routes');
const doctorsRoutes = require('./modules/doctors/doctors.routes');
const appointmentsRoutes = require('./modules/doctor/appointments/appointments.routes');
const consultationsRoutes = require('./modules/doctor/consultations/consultations.routes');
const admissionsRoutes = require('./modules/doctor/admissions/admissions.routes');
const ipdNotesRoutes = require('./modules/doctor/ipd-notes/ipdNotes.routes');
const treatmentRoutes = require('./modules/doctor/treatment/treatment.routes');
const patientsRoutes = require('./modules/doctor/patients/patients.routes');
const notificationsRoutes = require('./modules/doctor/notifications/notifications.routes');
const receptionistPatientsRoutes = require('./modules/receptionist/patients/patients.routes');
const receptionistAppointmentsRoutes = require('./modules/receptionist/appointments/appointments.routes');
const receptionistOpdRoutes = require('./modules/receptionist/opd/opd.routes');
const receptionistIpdRoutes = require('./modules/receptionist/ipd/ipd.routes');
const receptionistBillingRoutes = require('./modules/receptionist/billing/billing.routes');
const receptionistNotificationsRoutes = require('./modules/receptionist/notifications/notifications.routes');
const receptionistOtRoutes = require('./modules/receptionist/ot/ot.routes');
const receptionistRecoveryTransferRoutes = require('./modules/receptionist/recovery/recoveryTransfer.routes');
const adminDashboardRoutes = require('./modules/admin/dashboard/dashboard.routes');
const adminBedsRoutes = require('./modules/admin/beds/beds.routes');
const adminPatientsRoutes = require('./modules/admin/patients/patients.routes');
const adminOpdRoutes = require('./modules/admin/opd/opdAnalytics.routes');
const adminIpdRoutes = require('./modules/admin/ipd/ipdAnalytics.routes');
const adminFinanceRoutes = require('./modules/admin/billing/adminBilling.routes');
const nurseIpdRoutes = require('./modules/nurse/ipd/ipd.routes');
const nurseRoutes = require('./modules/nurse/nurse.routes');
const labRoutes = require('./modules/lab/lab.routes');
const pharmacySupplierRoutes = require('./routes/pharmacy/supplierRoutes');
const pharmacyMedicineRoutes = require('./routes/pharmacy/medicineRoutes');
const pharmacyPurchaseOrderRoutes = require('./routes/pharmacy/purchaseOrderRoutes');
const pharmacyGrnRoutes = require('./routes/pharmacy/grnRoutes');
const pharmacyInventoryRoutes = require('./routes/pharmacy/inventoryRoutes');
const pharmacyBillingRoutes = require('./routes/pharmacy/billingRoutes');
const pharmacyQueueRoutes = require('./routes/pharmacy/queueRoutes');
const pharmacyPendingDuesRoutes = require('./routes/pharmacy/pendingDuesRoutes');
const pharmacyBillingHistoryRoutes = require('./routes/pharmacy/billingHistoryRoutes');
const pharmacyDashboardRoutes = require('./routes/pharmacy/dashboardRoutes');
const pharmacyReturnsRoutes = require('./routes/pharmacy/returnsRoutes');
const pharmacyReportsRoutes = require('./routes/pharmacy/reportsRoutes');
const pharmacyProfileRoutes = require('./routes/pharmacy/profileRoutes');
const pharmacyOtIssueRoutes = require('./routes/pharmacy/otIssueRoutes');
const otRoutes = require('./modules/ot/ot.routes');
const doctorOtRoutes = require('./modules/doctor/ot-schedule/otSchedule.routes');
const assessmentRoutes = require('./modules/assessment/assessment.routes');
const hrRoutes = require('./modules/hr/hr.routes');
const patientAuthRoutes = require('./modules/patient/patientAuth.routes');
const patientPortalRoutes = require('./modules/patient/patientPortal.routes');
const assistantRoutes = require('./routes/assistant.routes');
const abdmRoutes = require('./modules/abdm/abdm.routes');
const {
  handleOnGenerateTokenCallback,
  handleOnCareContextCallback,
  handleOnContextNotifyCallback,
} = require('./modules/abdm/lib/abdmHipLinking');
const { handleDiscoverCallback } = require('./modules/abdm/callbacks/discovery.controller');
const { handleHealthInformationRequestCallback } = require('./modules/abdm/callbacks/dataFlowHip.controller');
const {
  handleHiuOnRequestCallback,
  handleHiuOnDataCallback,
} = require('./modules/abdm/callbacks/dataPushHiu.controller');
const { handleConsentHipNotifyCallback } = require('./modules/abdm/callbacks/consentHip.controller');
const {
  handleConsentHiuOnInitCallback,
  handleConsentHiuNotifyCallback,
  handleConsentHiuOnStatusCallback,
  handleConsentHiuOnFetchCallback,
} = require('./modules/abdm/callbacks/consentHiu.controller');
const { prisma, ensureDbConnection } = require('./config/prisma');
const { isDbConnected, setDbConnected } = require('./lib/dbState');
const app = express();

app.use(helmet());

const defaultOrigins = ['http://localhost:5173'];
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Vite picks next free port (5174, 5175...) when 5173 is busy
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

// Warm DB on API traffic — skip if a reconnect is already in progress.
app.use('/api', async (req, res, next) => {
  try {
    await ensureDbConnection();
    next();
  } catch (err) {
    setDbConnected(false);
    const msg = String(err?.message || err);
    if (!/Engine is not yet connected/i.test(msg)) {
      console.warn('[db] API paused — reconnecting:', msg);
    }
    return res.status(503).json({
      message: 'Database reconnecting. Please wait a few seconds and try again.',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/consultations', consultationsRoutes);
app.use('/api/admissions', admissionsRoutes);
app.use('/api/ipd-notes', ipdNotesRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/receptionist/patients', receptionistPatientsRoutes);
app.use('/api/receptionist/appointments', receptionistAppointmentsRoutes);
app.use('/api/receptionist/opd', receptionistOpdRoutes);
app.use('/api/receptionist/ipd', receptionistIpdRoutes);
app.use('/api/receptionist/billing', receptionistBillingRoutes);
app.use('/api/receptionist/notifications', receptionistNotificationsRoutes);
app.use('/api/receptionist/ot', receptionistOtRoutes);
app.use('/api/receptionist/recovery-transfers', receptionistRecoveryTransferRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/beds', adminBedsRoutes);
app.use('/api/admin/patients', adminPatientsRoutes);
app.use('/api/admin/opd', adminOpdRoutes);
app.use('/api/admin/ipd', adminIpdRoutes);
app.use('/api/admin/finance', adminFinanceRoutes);
app.use('/api/nurse/ipd', nurseIpdRoutes);
app.use('/api/nurse', nurseRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy/suppliers', pharmacySupplierRoutes);
app.use('/api/pharmacy/medicines', pharmacyMedicineRoutes);
app.use('/api/pharmacy/purchase-orders', pharmacyPurchaseOrderRoutes);
app.use('/api/pharmacy/grn', pharmacyGrnRoutes);
app.use('/api/pharmacy/inventory', pharmacyInventoryRoutes);
app.use('/api/pharmacy/billing', pharmacyBillingRoutes);
app.use('/api/pharmacy/queue', pharmacyQueueRoutes);
app.use('/api/pharmacy/pending-dues', pharmacyPendingDuesRoutes);
app.use('/api/pharmacy/billing-history', pharmacyBillingHistoryRoutes);
app.use('/api/pharmacy/dashboard', pharmacyDashboardRoutes);
app.use('/api/pharmacy/returns', pharmacyReturnsRoutes);
app.use('/api/pharmacy/reports', pharmacyReportsRoutes);
app.use('/api/pharmacy/profile', pharmacyProfileRoutes);
app.use('/api/pharmacy/ot-issue', pharmacyOtIssueRoutes);
app.use('/api/ot', otRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/doctor/ot', doctorOtRoutes);
app.use('/api/patient', patientAuthRoutes);
app.use('/api/patient/portal', patientPortalRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/abdm', abdmRoutes);

// ABDM M2 HIP callback. Gateway posts to the bridge root + this exact path.
// Existing /api/abdm/... callback routes stay mounted for backward compatibility.
app.post('/api/v3/hip/token/on-generate-token', async (req, res) => {
  const result = await handleOnGenerateTokenCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM posts this to the bridge root after care-context linking. Acknowledge only.
app.post('/api/v3/link/on_carecontext', async (req, res) => {
  const result = await handleOnCareContextCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM posts this to the bridge root after context notify. Acknowledge only.
app.post('/api/v3/links/context/on-notify', async (req, res) => {
  const result = await handleOnContextNotifyCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM M2 user-initiated discovery. Acknowledge only after on-discover is handled.
app.post('/api/v3/hip/patient/care-context/discover', async (req, res) => {
  const result = await handleDiscoverCallback(req.body || {}, req.headers || {});
  return res.status(result.status).json(result.body);
});

// ABDM M2 6.3.1 consent notify. Acknowledge with 6.3.2 hip/on-notify.
app.post('/api/v3/consent/request/hip/notify', async (req, res) => {
  const result = await handleConsentHipNotifyCallback(req.body || {}, req.headers || {});
  return res.status(result.status).json(result.body);
});

// ABDM M3 HIU consent request on-init. Acknowledge only.
app.post('/api/v3/hiu/consent/request/on-init', async (req, res) => {
  const result = await handleConsentHiuOnInitCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM M3 HIU consent request notify. Persist status only.
app.post('/api/v3/hiu/consent/request/notify', async (req, res) => {
  const result = await handleConsentHiuNotifyCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM M3 HIU consent request on-status. Persist status only.
app.post('/api/v3/hiu/consent/request/on-status', async (req, res) => {
  const result = await handleConsentHiuOnStatusCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM M3 HIU consent on-fetch. Persist artefact only.
app.post('/api/v3/hiu/consent/on-fetch', async (req, res) => {
  const result = await handleConsentHiuOnFetchCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

app.post('/api/v3/hiu/health-information/on-request', async (req, res) => {
  const result = await handleHiuOnRequestCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

app.post('/api/v3/hiu/health-information/on-data', async (req, res) => {
  const result = await handleHiuOnDataCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

// ABDM M2 6.3.3 health-information request. Acknowledge with 6.3.4 on-request.
app.post('/api/v3/hip/health-information/request', async (req, res) => {
  const result = await handleHealthInformationRequestCallback(req.body || {}, req.headers || {});
  return res.status(result.status).json(result.body);
});

app.get('/api/health', async (req, res) => {
  let db = 'unknown';
  try {
    if (isDbConnected()) {
      await prisma.$queryRaw`SELECT 1`;
      db = 'connected';
    } else {
      db = 'disconnected';
    }
  } catch {
    db = 'error';
  }
  res.json({ status: db === 'connected' ? 'OK' : 'DEGRADED', db, message: 'VyanX Hospital Management System API running' });
});

// ─── Serve production frontend build ───
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    } else {
      next();
    }
  });
}

module.exports = app;
