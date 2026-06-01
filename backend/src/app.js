const express = require('express');
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
const adminDashboardRoutes = require('./modules/admin/dashboard/dashboard.routes');
const adminBedsRoutes = require('./modules/admin/beds/beds.routes');
const adminPatientsRoutes = require('./modules/admin/patients/patients.routes');
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
const app = express();

app.use(helmet());

const defaultOrigins = ['http://localhost:5173'];
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // allow non-browser clients (no Origin header)
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

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
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/beds', adminBedsRoutes);
app.use('/api/admin/patients', adminPatientsRoutes);
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

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'New H T Hospital API running' }));

module.exports = app;
