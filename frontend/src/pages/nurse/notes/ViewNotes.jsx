import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { admissionIdFromRow } from '../../../utils/admissionId';
import './ViewNotes.css';

function mapAssignedRow(row) {
  const admissionId = admissionIdFromRow(row);
  return {
    admissionId,
    patientId: row.patientId ?? null,
    name: row.name || '',
    uhid: row.uhid || '',
    ward: row.ward || '',
    bed: row.bed || '',
  };
}

export default function ViewNotes() {
  const { user } = useAuth();
  const viewerId = user?.id != null ? String(user.id) : '';

  const [patients, setPatients] = useState([]);
  const [listError, setListError] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [search, setSearch] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    text: '',
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/nurse/ipd/assigned');
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const mapped = items.map(mapAssignedRow).filter((p) => p.admissionId);
        if (!alive) return;
        setPatients(mapped);
        setListError('');
        setSelectedPatient((prev) => {
          if (prev && mapped.some((x) => x.admissionId === prev.admissionId)) return prev;
          return mapped[0] || null;
        });
      } catch (e) {
        if (!alive) return;
        setPatients([]);
        setListError(e?.response?.data?.message || 'Could not load patients');
        setSelectedPatient(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadNotesForAdmission = useCallback(async (admissionId) => {
    if (!admissionId) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    setNotesError('');
    try {
      const res = await api.get(`/nurse/patient/${admissionId}`);
      const raw = Array.isArray(res?.data?.notes) ? res.data.notes : [];
      setNotes(
        raw.map((n) => ({
          id: n.id,
          nurseId: n.nurseId != null ? String(n.nurseId) : '',
          nurseName: n.nurseName || '',
          text: n.text || '',
          date: n.date || '—',
        })),
      );
    } catch (e) {
      setNotes([]);
      setNotesError(e?.response?.data?.message || 'Could not load notes');
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPatient?.admissionId) {
      setNotes([]);
      return;
    }
    loadNotesForAdmission(selectedPatient.admissionId);
  }, [selectedPatient, loadNotesForAdmission]);

  const handleSelectPatient = (p) => {
    setSelectedPatient((prev) => (prev?.admissionId === p.admissionId ? null : p));
    setEditOpen(false);
    setEditId(null);
  };

  const handleDeleteNote = async (noteId) => {
    if (!selectedPatient?.admissionId) return;
    try {
      await api.delete(`/nurse/notes/${noteId}`);
      await loadNotesForAdmission(selectedPatient.admissionId);
    } catch (e) {
      setNotesError(e?.response?.data?.message || 'Delete failed');
      window.setTimeout(() => setNotesError(''), 3000);
    }
  };

  const handleEditNote = (noteObj) => {
    setEditId(noteObj.id);
    setEditDraft({
      text: noteObj.text === '—' ? '' : noteObj.text,
    });
    setEditOpen(true);
  };

  const handleUpdateNote = async () => {
    if (!selectedPatient?.admissionId || !editId) return;
    const text = String(editDraft.text || '').trim();
    if (!text) return;
    try {
      await api.put(`/nurse/notes/${editId}`, { notes: text });
      await loadNotesForAdmission(selectedPatient.admissionId);
      setEditOpen(false);
      setEditId(null);
    } catch (e) {
      setNotesError(e?.response?.data?.message || 'Update failed');
      window.setTimeout(() => setNotesError(''), 3000);
    }
  };

  const filteredPatients = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const uhid = String(p.uhid || '').toLowerCase();
      return name.includes(q) || uhid.includes(q);
    });
  }, [patients, search]);

  return (
    <div className="view-notes-container">
      <div className="view-notes-card">
        <div className="view-notes-card-header">
          <div className="view-notes-searchWrap">
            <input
              id="view-notes-search"
              className="view-notes-searchInput"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Patient Name / UHID"
              autoComplete="off"
            />
          </div>
        </div>

        {listError ? <div className="view-notes-empty view-notes-empty-inline">{listError}</div> : null}

        <div className="view-notes-patientCards">
          {filteredPatients.length === 0 ? (
            <div className="view-notes-empty view-notes-empty-inline">No assigned patients found</div>
          ) : (
            filteredPatients.map((p) => {
              const open = selectedPatient?.admissionId === p.admissionId;
              return (
                <div
                  key={p.admissionId}
                  className={['view-notes-patientCard', open ? 'view-notes-patientCard-open' : ''].join(' ')}
                >
                  <button type="button" className="view-notes-patientBtn" onClick={() => handleSelectPatient(p)}>
                    <div className="view-notes-patient-name">{p.name}</div>
                    <div className="view-notes-patient-sub">
                      <span className="view-notes-mono">{p.uhid}</span> · {p.ward} · <span className="view-notes-mono">{p.bed}</span>
                    </div>
                    <div className="view-notes-patientOpen">{open ? 'Hide' : 'View'}</div>
                  </button>

                  {open ? (
                    <div className="view-notes-notesInline">
                      {notesError ? <div className="view-notes-empty view-notes-empty-inline">{notesError}</div> : null}
                      {notesLoading ? (
                        <div className="view-notes-empty view-notes-empty-inline">Loading notes…</div>
                      ) : notes.length === 0 ? (
                        <div className="view-notes-empty view-notes-empty-inline">No notes found</div>
                      ) : (
                        <div className="view-notes-note-list">
                          {notes.map((n) => {
                            const canEdit = viewerId && n.nurseId === viewerId;
                            return (
                              <div key={n.id} className="view-notes-note">
                                <div className="view-notes-note-top">
                                  <div>
                                    <div className="view-notes-note-date">{n.date}</div>
                                    {n.nurseName ? (
                                      <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 2 }}>{n.nurseName}</div>
                                    ) : null}
                                  </div>
                                  <div className="view-notes-note-actions">
                                    {canEdit ? (
                                      <>
                                        <button type="button" className="view-notes-btn view-notes-btn-edit" onClick={() => handleEditNote(n)}>
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="view-notes-btn view-notes-btn-delete"
                                          onClick={() => handleDeleteNote(n.id)}
                                        >
                                          Delete
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="view-notes-note-text">{n.text || '—'}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {editOpen ? (
        <div className="view-notes-modal-overlay" role="dialog" aria-modal="true">
          <div className="view-notes-modal">
            <div className="view-notes-modal-header">
              <div className="view-notes-modal-title">Edit Note</div>
              <button type="button" className="view-notes-btn view-notes-btn-close" onClick={() => setEditOpen(false)}>
                Close
              </button>
            </div>

            <div className="view-notes-modal-body">
              <div className="view-notes-field">
                <label className="view-notes-label">Note</label>
                <textarea
                  className="view-notes-textarea"
                  rows={5}
                  value={editDraft.text}
                  onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
                  placeholder="Enter patient observation…"
                />
              </div>

              <div className="view-notes-modal-actions">
                <button type="button" className="view-notes-btn view-notes-btn-secondary" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="view-notes-btn view-notes-btn-primary"
                  onClick={handleUpdateNote}
                  disabled={!String(editDraft.text).trim()}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
