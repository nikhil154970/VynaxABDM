import './DischargeSummaryEditor.css';

import {

  fromDateTimeLocalValue,

  toDateInputValue,

  toDateTimeLocalValue,

  toTimeInputValue,

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



function SexCheck({ label, checked, onChange }) {

  return (

    <label className="dse-pill" style={{ cursor: 'pointer' }}>

      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ marginRight: 6 }} />

      {label}

    </label>

  );

}



export default function DeathCertificateForm({ deathForm, onChange }) {

  const f = deathForm || {};

  const pod = f.placeOfDeath || {};

  const set = (patch) => onChange({ ...f, ...patch });

  const setPod = (patch) => onChange({ ...f, placeOfDeath: { ...pod, ...patch } });



  return (

    <div className="dse-grid">

      <section className="dse-card dse-card--full">

        <p className="dse-formNote">Provisional death certificate (hospital use only). Not valid for legal death registration.</p>

        <div className="dse-twoCol">

          <Field label="Certificate no.">

            <Input value={f.certificateNo} onChange={(v) => set({ certificateNo: v })} />

          </Field>

          <Field label="Date of issue">

            <Input type="date" value={toDateInputValue(f.dateOfIssue)} onChange={(v) => set({ dateOfIssue: v })} />

          </Field>

          <Field label="Hospital registration no.">

            <Input value={f.hospitalRegNo} onChange={(v) => set({ hospitalRegNo: v })} />

          </Field>

        </div>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">1 · Patient details</h3>

        <div className="dse-twoCol">

          <Field label="Patient name">

            <Input value={f.patientName} onChange={(v) => set({ patientName: v })} />

          </Field>

          <Field label="Age / sex (text)">

            <Input value={f.ageSex} onChange={(v) => set({ ageSex: v })} />

          </Field>

          <div className="dse-field" style={{ gridColumn: '1 / -1' }}>

            <div className="dse-label">Sex</div>

            <div className="dse-row">

              <SexCheck

                label="Male"

                checked={f.sexMale}

                onChange={(v) => set({ sexMale: v, sexFemale: v ? false : f.sexFemale, sexOther: v ? false : f.sexOther })}

              />

              <SexCheck

                label="Female"

                checked={f.sexFemale}

                onChange={(v) => set({ sexFemale: v, sexMale: v ? false : f.sexMale, sexOther: v ? false : f.sexOther })}

              />

              <SexCheck

                label="Other"

                checked={f.sexOther}

                onChange={(v) => set({ sexOther: v, sexMale: v ? false : f.sexMale, sexFemale: v ? false : f.sexFemale })}

              />

            </div>

          </div>

          <Field label="UHID no.">

            <Input value={f.uhidNo} onChange={(v) => set({ uhidNo: v })} />

          </Field>

          <Field label="IPD no.">

            <Input value={f.ipdNo} onChange={(v) => set({ ipdNo: v })} />

          </Field>

          <Field label="Address">

            <TextArea value={f.address} onChange={(v) => set({ address: v })} rows={2} />

          </Field>

        </div>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">2 · Admission & death details</h3>

        <div className="dse-twoCol">

          <Field label="Date of admission">

            <Input type="date" value={toDateInputValue(f.admissionDate)} onChange={(v) => set({ admissionDate: v })} />

          </Field>

          <Field label="Time of admission">

            <Input type="time" value={toTimeInputValue(f.admissionTime)} onChange={(v) => set({ admissionTime: v })} />

          </Field>

          <Field label="Date of death">

            <Input type="date" value={toDateInputValue(f.deathDate)} onChange={(v) => set({ deathDate: v })} />

          </Field>

          <Field label="Time of death">

            <Input type="time" value={toTimeInputValue(f.deathTime)} onChange={(v) => set({ deathTime: v })} />

          </Field>

          <div className="dse-field" style={{ gridColumn: '1 / -1' }}>

            <div className="dse-label">Place of death</div>

            <div className="dse-row">

              <SexCheck label="In hospital" checked={pod.inHospital} onChange={(v) => setPod({ inHospital: v })} />

              <SexCheck label="ICU" checked={pod.icu} onChange={(v) => setPod({ icu: v })} />

              <SexCheck label="Other" checked={pod.other} onChange={(v) => setPod({ other: v })} />

              <Input value={pod.otherText} onChange={(v) => setPod({ otherText: v })} placeholder="Other (specify)" />

            </div>

          </div>

          <Field label="Ward / unit / ICU">

            <Input value={f.wardUnit} onChange={(v) => set({ wardUnit: v })} />

          </Field>

        </div>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">3 · Provisional cause of death</h3>

        <Field label="a) Immediate cause">

          <TextArea value={f.causeImmediate} onChange={(v) => set({ causeImmediate: v })} rows={2} />

        </Field>

        <Field label="b) Antecedent cause(s)">

          <TextArea value={f.causeAntecedent} onChange={(v) => set({ causeAntecedent: v })} rows={2} />

        </Field>

        <Field label="c) Other significant conditions">

          <TextArea value={f.causeOther} onChange={(v) => set({ causeOther: v })} rows={2} />

        </Field>

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">4 · Clinical summary</h3>

        <TextArea value={f.clinicalSummary} onChange={(v) => set({ clinicalSummary: v })} rows={6} />

      </section>



      <section className="dse-card">

        <h3 className="dse-sectionTitle">5 · Provisional certification</h3>

        <div className="dse-twoCol">

          <Field label="Name of doctor">

            <Input value={f.doctorName} onChange={(v) => set({ doctorName: v })} />

          </Field>

          <Field label="Designation">

            <Input value={f.doctorDesignation} onChange={(v) => set({ doctorDesignation: v })} />

          </Field>

          <Field label="Medical registration no.">

            <Input value={f.doctorRegNo} onChange={(v) => set({ doctorRegNo: v })} />

          </Field>

          <Field label="Certification date & time">

            <Input

              type="datetime-local"

              value={toDateTimeLocalValue(f.certDateTime)}

              onChange={(v) => set({ certDateTime: fromDateTimeLocalValue(v) })}

            />

          </Field>

        </div>

      </section>

    </div>

  );

}


