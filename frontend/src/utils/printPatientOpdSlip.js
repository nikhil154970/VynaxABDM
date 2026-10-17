import patientApi from './patientApi';
import { buildOpdSlipHtml } from './printOpdSlip';

/**
 * Opens the OPD receipt/slip for a patient's appointment in a new window.
 * Uses the exact same template as the reception slip.
 * @param {string} appointmentId
 */
export async function printPatientOpdSlip(appointmentId) {
  if (!appointmentId) return;

  const res = await patientApi.get(`/patient/portal/appointments/${encodeURIComponent(appointmentId)}`);
  const a = res?.data?.appointment;
  if (!a) return;

  const row = {
    opdNumber: a.opdNumber,
    token: a.token,
    registrationNumber: a.registrationNumber,
    patientName: a.patientName,
    mobile: a.mobile,
    age: a.age,
    gender: a.gender,
    address: a.address,
    weight: a.weight,
    doctorName: a.doctorName,
    date: a.date,
    time: a.time,
    createdAt: a.createdAt,
    fee: a.fee,
    paymentMode: a.paymentMode,
    paymentStatus: a.paymentStatus,
  };

  const html = buildOpdSlipHtml(row);

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;

  w.document.open();
  w.document.write(html);
  w.document.close();

  setTimeout(() => {
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
  }, 600);
}
