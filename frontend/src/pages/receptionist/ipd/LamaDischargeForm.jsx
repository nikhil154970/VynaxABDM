import './DischargeSummaryEditor.css';

import {

  fromDateTimeLocalValue,

  toDateInputValue,

  toDateTimeLocalValue,

} from './dischargeFormBuilders';



function Field({ label, children }) {

  return (

    <label className="dse-field">

      <div className="dse-label">{label}</div>

      {children}

    </label>

  );

}



function Input({ value, onChange, placeholder, type = 'text' }) {

  return (

    <input

      className="dse-input"

      value={value ?? ''}

      type={type}

      placeholder={placeholder}

      onChange={(e) => onChange(e.target.value)}

    />

  );

}



function TextArea({ value, onChange, rows = 4 }) {

  return (

    <textarea className="dse-textarea" value={value ?? ''} rows={rows} onChange={(e) => onChange(e.target.value)} />

  );

}



function InvCheck({ label, checked, onChange }) {

  return (

    <label className="dse-pill" style={{ cursor: 'pointer' }}>

      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ marginRight: 6 }} />

      {label}

    </label>

  );

}



export default function LamaDischargeForm({ lama, onChange }) {

  const f = lama || {};

  const inv = f.investigations || {};

  const set = (patch) => onChange({ ...f, ...patch });

  const setInv = (patch) => onChange({ ...f, investigations: { ...inv, ...patch } });



  return (

    <div className="dse-grid">

      <section className="dse-card dse-card--full">

        <p className="dse-formNote">

          Leave Against Medical Advice (LAMA) — not a regular discharge. Complete all sections before save.

        </p>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">1 · Patient details</h3>

        <div className="dse-twoCol">

          <Field label="Patient name">

            <Input

              value={f.patientName}

              onChange={(v) =>

                set({

                  patientName: v,

                  declarationName: f.declarationName || v,

                })

              }

            />

          </Field>

          <Field label="Age">

            <Input

              value={f.age ?? (f.ageSex ? String(f.ageSex).split('/')[0]?.trim() : '')}

              onChange={(v) => {

                const sex = f.sex ?? (f.ageSex && String(f.ageSex).includes('/') ? String(f.ageSex).split('/').slice(1).join('/').trim() : '');

                set({ age: v, ageSex: [v, sex].filter(Boolean).join(' / ') });

              }}

              placeholder="e.g. 22"

            />

          </Field>

          <Field label="Sex">

            <select

              className="dse-input"

              value={f.sex ?? ''}

              onChange={(e) => {

                const sex = e.target.value;

                const age = f.age ?? (f.ageSex ? String(f.ageSex).split('/')[0]?.trim() : '');

                set({ sex, ageSex: [age, sex].filter(Boolean).join(' / ') });

              }}

            >

              <option value="">Select</option>

              <option value="Male">Male</option>

              <option value="Female">Female</option>

              <option value="Other">Other</option>

            </select>

          </Field>

          <Field label="Address">

            <TextArea value={f.address} onChange={(v) => set({ address: v })} rows={2} />

          </Field>

          <Field label="Phone no.">

            <Input value={f.phone} onChange={(v) => set({ phone: v })} />

          </Field>

          <Field label="Admitted on">

            <Input

              type="date"

              value={toDateInputValue(f.admittedOn)}

              onChange={(v) => set({ admittedOn: v })}

            />

          </Field>

          <Field label="Ward / unit / bed no.">

            <Input value={f.wardBed} onChange={(v) => set({ wardBed: v })} />

          </Field>

          <Field label="Consultant / doctor in-charge">

            <Input value={f.consultant} onChange={(v) => set({ consultant: v })} />

          </Field>

        </div>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">2 · Clinical summary</h3>

        <Field label="Provisional / working diagnosis">

          <TextArea value={f.diagnosis} onChange={(v) => set({ diagnosis: v })} />

        </Field>

        <Field label="Brief summary of illness / condition">

          <TextArea value={f.illnessSummary} onChange={(v) => set({ illnessSummary: v })} rows={5} />

        </Field>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">3 · Investigations</h3>

        <div className="dse-row" style={{ marginBottom: 10 }}>

          <InvCheck label="CBC" checked={inv.cbc} onChange={(v) => setInv({ cbc: v })} />

          <InvCheck label="RBS" checked={inv.rbs} onChange={(v) => setInv({ rbs: v })} />

          <InvCheck label="KFT" checked={inv.kft} onChange={(v) => setInv({ kft: v })} />

          <InvCheck label="LFT" checked={inv.lft} onChange={(v) => setInv({ lft: v })} />

          <InvCheck label="ECG" checked={inv.ecg} onChange={(v) => setInv({ ecg: v })} />

          <InvCheck label="X-Ray" checked={inv.xray} onChange={(v) => setInv({ xray: v })} />

          <InvCheck label="USG" checked={inv.usg} onChange={(v) => setInv({ usg: v })} />

          <InvCheck label="Others" checked={inv.others} onChange={(v) => setInv({ others: v })} />

        </div>

        <Field label="Others (specify)">

          <Input value={inv.othersText} onChange={(v) => setInv({ othersText: v })} />

        </Field>

        <Field label="Summary / significant findings">

          <TextArea value={f.investigationFindings} onChange={(v) => set({ investigationFindings: v })} />

        </Field>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">4 · Treatment given</h3>

        <Field label="Treatment / management provided">

          <TextArea value={f.treatmentGiven} onChange={(v) => set({ treatmentGiven: v })} rows={5} />

        </Field>

      </section>



      <section className="dse-card dse-card--full">

        <h3 className="dse-sectionTitle">5 · Advice of doctor & risks explained</h3>

        <p className="dse-staticBlock">

          Standard risks (worsening condition, complications, ICU need, life-threatening delay, permanent injury,

          morbidity, death) are included on the printed LAMA form. Patient / attendant has decided to leave against

          medical advice.

        </p>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">6 · Declaration</h3>

        <Field label="Name of patient / attendant">

          <Input value={f.declarationName} onChange={(v) => set({ declarationName: v })} />

        </Field>

        <Field label="S/o / D/o / W/o (name)">

          <Input value={f.declarationRelationName} onChange={(v) => set({ declarationRelationName: v })} />

        </Field>

        <Field label="Reason for leaving (if stated)">

          <TextArea value={f.reasonForLeaving} onChange={(v) => set({ reasonForLeaving: v })} rows={2} />

        </Field>

      </section>



      <section className="dse-card dse-card--full">

        <h3 className="dse-sectionTitle">7 · Signatures</h3>

        <div className="dse-twoCol">

          <Field label="Patient / attendant signature">

            <Input value={f.sigPatient} onChange={(v) => set({ sigPatient: v })} />

          </Field>

          <Field label="Date & time (patient)">

            <Input

              type="datetime-local"

              value={toDateTimeLocalValue(f.sigPatientDate)}

              onChange={(v) => set({ sigPatientDate: fromDateTimeLocalValue(v) })}

            />

          </Field>

          <Field label="Attendant name & relationship">

            <Input value={f.sigAttendantName} onChange={(v) => set({ sigAttendantName: v })} />

          </Field>

          <Field label="Date & time (attendant)">

            <Input

              type="datetime-local"

              value={toDateTimeLocalValue(f.sigAttendantDate)}

              onChange={(v) => set({ sigAttendantDate: fromDateTimeLocalValue(v) })}

            />

          </Field>

          <Field label="Doctor signature (explained risks)">

            <Input value={f.sigDoctor} onChange={(v) => set({ sigDoctor: v })} />

          </Field>

          <Field label="Date & time (doctor)">

            <Input

              type="datetime-local"

              value={toDateTimeLocalValue(f.sigDoctorDate)}

              onChange={(v) => set({ sigDoctorDate: fromDateTimeLocalValue(v) })}

            />

          </Field>

          <Field label="Witness (staff)">

            <Input value={f.sigWitness} onChange={(v) => set({ sigWitness: v })} />

          </Field>

          <Field label="Date & time (witness)">

            <Input

              type="datetime-local"

              value={toDateTimeLocalValue(f.sigWitnessDate)}

              onChange={(v) => set({ sigWitnessDate: fromDateTimeLocalValue(v) })}

            />

          </Field>

        </div>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">8 · Follow-up advice</h3>

        <Field label="Report immediately in case of">

          <Input value={f.followUpReportIf} onChange={(v) => set({ followUpReportIf: v })} />

        </Field>

        <div className="dse-twoCol">

          <Field label="Follow-up on / after">

            <Input type="date" value={toDateInputValue(f.followUpOn)} onChange={(v) => set({ followUpOn: v })} />

          </Field>

          <Field label="At">

            <Input value={f.followUpAt} onChange={(v) => set({ followUpAt: v })} />

          </Field>

          <Field label="Contact / emergency no.">

            <Input value={f.followUpContact} onChange={(v) => set({ followUpContact: v })} />

          </Field>

        </div>

      </section>

    </div>

  );

}


