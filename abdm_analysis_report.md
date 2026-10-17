# VyanX HIMS — ABDM/ABHA Integration Analysis Report

---

## 1. Project Overview

### Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | ^19.2.5 |
| Frontend Build | Vite | ^8.0.8 |
| Routing | react-router-dom | ^7.14.1 |
| Styling | Tailwind CSS | ^4.2.2 |
| Backend | Express | ^5.2.1 |
| ORM | Prisma | ^6.16.1 |
| Database | PostgreSQL | — |
| Auth | JWT (jsonwebtoken) | ^9.0.3 |
| Password Hashing | bcrypt | ^6.0.0 |
| Validation | express-validator | ^7.3.2 |
| Icons | lucide-react, react-icons | — |
| Charts | recharts | ^2.15.0 |

### Folder Structure
```
D:\VyanX\
├── frontend/              # React SPA (Vite)
│   ├── src/
│   │   ├── App.jsx        # Route definitions
│   │   ├── components/    # Shared UI components
│   │   ├── context/       # Auth contexts
│   │   ├── pages/         # Page components by role
│   │   ├── services/      # API service wrappers
│   │   └── utils/         # Utilities
├── backend/
│   ├── server.js          # Entry point
│   ├── src/
│   │   ├── app.js         # Express app + route mounting
│   │   ├── config/        # JWT, Prisma config
│   │   ├── middleware/     # Auth, role, validation
│   │   ├── controllers/   # Auth, users, pharmacy
│   │   ├── modules/       # Feature modules (receptionist, doctor, nurse, lab, ot, admin, hr, patient)
│   │   ├── routes/        # Auth + pharmacy routes
│   │   ├── lib/           # Helpers, seeds
│   │   └── utils/         # Shared utilities
│   └── prisma/
│       └── schema.prisma  # Full database schema (2143 lines)
├── Mytho_AI/              # Python AI assistant
```

### Route Mounting (app.js lines 105-155)
All 49+ route groups mounted at `/api/*`. Full list in analysis above.

---

## 2. Existing Hospital Modules

| Module | Status | Key Files |
|--------|--------|-----------|
| **Authentication** | ✅ Complete | Staff login (JWT 15min expiry), patient login (24h expiry). No refresh tokens. |
| **Reception** | ✅ Complete | Patient registration, appointments, OPD/IPD, billing, OT, recovery transfer |
| **Patient Registration** | ✅ Complete | UHID (UH{YYYYMMDD}{RRRR}), registration number (REG-{NNN}), aadhaarId field exists |
| **OPD** | ✅ Complete | Walk-in registration, consultations, billing |
| **IPD** | ✅ Complete | Admission, bed assignment, discharge, billing |
| **Doctor** | ✅ Complete | Consultations, prescriptions, IPD notes, treatment plans, OT schedule |
| **Nurse** | ✅ Complete | Vitals, nursing notes, OT requests, tasks, doctor orders, medicine requests |
| **OT** | ✅ Complete | Surgery scheduling, rooms, equipment, consumables, recovery, post-surgery |
| **Lab** | ✅ Complete | Test catalog, orders, results, reports, bills |
| **Pharmacy** | ✅ Complete | Supplier, PO, GRN, inventory, billing, returns, queue, OT issue |
| **Billing** | ✅ Complete | OPD/IPD bills, pharmacy bills, lab bills, OT bills, payments |
| **HR** | ✅ Complete | Employees, duty roster, allocation requests, shifts |
| **Dashboard** | ✅ Complete | Role-specific dashboards (admin, doctor, nurse, pharmacy) |
| **Patient Portal** | ✅ Complete | Self-registration, appointments, prescriptions, lab reports, bills |
| **Notifications** | ✅ Complete | In-app notifications per role |
| **Reports** | ✅ Complete | Pharmacy reports, HR reports, revenue analytics |

---

## 3. Existing Patient Registration Flow

1. Receptionist or patient (self) fills name, age/dob, gender, mobile, address
2. System generates UHID: `UH{YYYYMMDD}{RRRR}` (random 4-digit suffix)
3. System generates registration number: `REG-{auto-increment}`
4. Aadhaar field exists in form (`aadhaarId`) but no ABHA linkage
5. Mobile verification: **NOT implemented** (no SMS gateway)
6. Registration creates: `Patient` + `PatientAuth` (password hashed) + optional `ReceptionVisit`
7. Existing validation: basic field checks only (name required, etc.)

### Existing Registration APIs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/receptionist/patients` | Create patient (receptionist) |
| POST | `/api/patient/auth/register` | Self-registration (patient portal) |

---

## 4. Existing ABHA / ABDM Features

### ❌ What exists on backend:
**NOTHING.** Zero ABDM backend code exists:
- No ABDM routes mounted in app.js
- No ABHA controllers or services
- No HIP/HIU implementation
- No consent management
- No care context
- No FHIR resources or converters
- No HPR/HFR registration
- No bridge registration
- No callback APIs
- No encryption utilities (RSA, ECDH)
- No ABDM token cache
- No ABDM audit logging

### ⚠ What exists on frontend only (incomplete):
| File | Purpose | Status |
|------|---------|--------|
| `frontend/src/services/abdm/abhaService.js` | ABHA send OTP / verify OTP service | ⚠ Frontend only — calls non-existent backend routes |
| `frontend/src/components/abdm/AbhaVerificationModal.jsx` | ABHA verification modal UI | ⚠ Frontend only — no backend to connect to |
| `frontend/src/components/abdm/OtpInput.jsx` | OTP input component | ✅ Complete but unused without backend |

The frontend env config points to:
- `VITE_ABDM_SEND_OTP_PATH=/abdm/abha/send-otp` — **NO backend route exists**
- `VITE_ABDM_VERIFY_OTP_PATH=/abdm/abha/verify-otp` — **NO backend route exists**

---

## 5. Database Analysis — ABDM Readiness

### Patient Model (current fields)
```
id (UUID) — PK
name, uhid, regSeq, registrationNumber, age, gender, mobile
basicHistory, dob, aadhaarId ← Aadhaar field exists
address, bloodGroup, allergies, heightCm, weightKg
emergencyName, emergencyPhone, emergencyRelation
registrationSource, createdAt
```

### Fields Missing for ABDM
| Field | Model | Purpose |
|-------|-------|---------|
| `abhaNumber` | Patient | ABHA (Ayushman Bharat Health Account) number (17-digit) |
| `abhaAddress` | Patient | ABHA address (e.g., name@abdm) |
| `abhaVerified` | Patient | Whether ABHA is verified |
| `healthId` | Patient | Legacy ABHA health ID |
| `healthIdNumber` | Patient | Legacy ABHA number |
| `hipConsent` | Patient | HIP consent flag |
| `careContexts` | Patient → new model | Linked care contexts |
| `consentArtefacts` | New model | Consent records |
| `fhirResources` | New model | FHIR resource references |
| `abdmAuditLog` | New model | ABDM audit trail |
| `abhaProfile` | New model | Cached ABHA profile data |

### No Models Need ABDM Changes (for Milestone 1)
All clinical models (Consultation, Admission, LabOrder, Bill, etc.) are fine for now — they'll need FHIR mapping later for Milestone 2/3.

---

## 6. API Analysis — Patient-Related Endpoints

| Endpoint | Controller | Purpose |
|----------|-----------|---------|
| `POST /api/receptionist/patients` | patients.controller | Create patient |
| `GET /api/receptionist/patients` | patients.controller | Search/list patients |
| `GET /api/receptionist/patients/:id` | patients.controller | Get patient details |
| `PUT /api/receptionist/patients/:id` | patients.controller | Update patient |
| `POST /api/patient/auth/register` | patientAuth.controller | Self-register |
| `POST /api/patient/auth/login` | patientAuth.controller | Patient login |
| `GET /api/patient/portal/dashboard` | patientPortal.controller | Patient dashboard |
| `GET /api/patient/portal/profile` | patientPortal.controller | Get profile |
| `PUT /api/patient/portal/profile` | patientPortal.controller | Update profile |
| `GET /api/patient/me` | patientAuth.controller | Get current patient |
| `GET /api/patient/me/visits` | patientAuth.controller | Patient visits |
| `GET /api/patient/me/bills` | patientAuth.controller | Patient bills |

**All patient endpoints return `Patient` data — none include ABHA fields because they don't exist in the model yet.**

---

## 7. Security Analysis

| Feature | Status | Details |
|---------|--------|---------|
| **JWT Authentication** | ✅ | jsonwebtoken, secret from env, configurable expiry |
| **Role-Based Access** | ✅ | roleMiddleware — checks req.user.role against allowed list |
| **Password Hashing** | ✅ | bcrypt, salt rounds = 12 |
| **HTTPS Readiness** | ⚠ | Behind reverse proxy assumption; no HTTPS config in Express |
| **Helmet** | ✅ | Security headers middleware enabled |
| **CORS** | ✅ | Configured for localhost:5173 + FRONTEND_URL from env |
| **Request Validation** | ✅ | express-validator on all routes |
| **Encryption (at rest)** | ❌ | No field-level encryption |
| **Encryption (RSA/ECDH)** | ❌ | Not implemented (required for ABDM) |
| **Audit Logging** | ⚠ | Basic `ActivityLog` model exists but no ABDM-specific audit |
| **Public Callback Support** | ❌ | No callback endpoints (required for ABDM) |
| **Rate Limiting** | ❌ | Not implemented |

---

## 8. Missing Features — Full ABDM Readiness Checklist

### Milestone 1: ABHA (Ayushman Bharat Health Account)

| Feature | Status | Notes |
|---------|--------|-------|
| ABHA field in Patient model | ❌ Missing | Need `abhaNumber`, `abhaAddress`, `abhaVerified` |
| Aadhaar field in Patient model | ✅ Exists | `aadhaarId` field present |
| ABHA send OTP API | ❌ Missing | Frontend service exists, no backend |
| ABHA verify OTP API | ❌ Missing | Frontend service exists, no backend |
| ABHA create/generate API | ❌ Missing | Not implemented |
| ABHA search by demographic | ❌ Missing | Not implemented |
| ABHA profile fetch | ❌ Missing | Not implemented |
| ABHA deactivation | ❌ Missing | Not implemented |
| Patient registration with ABHA | ❌ Missing | Flow not integrated into registration |
| RxWallet integration | ❌ Missing | Not implemented |
| ABHA QR code generation | ❌ Missing | Not implemented |

### Milestone 2: HIP (Health Information Provider)

| Feature | Status | Notes |
|---------|--------|-------|
| HIP Registration on ABDM | ❌ Missing | Need HPR registration |
| HIP Certificate Management | ❌ Missing | RSA key pair, certificate |
| ABDM Gateway Integration | ❌ Missing | Gateway API connectivity |
| Care Context Creation | ❌ Missing | Need per-encounter care context |
| Care Context Discovery | ❌ Missing | Need discovery APIs |
| FHIR Resource Generation | ❌ Missing | Need FHIR converters for all clinical data |
| Consent Management | ❌ Missing | Need consent artefact handling |
| Data Push (HIP -> HIU) | ❌ Missing | Need notification + data push APIs |
| Data On Request (HIP polling) | ❌ Missing | Need request polling |
| ABDM Audit Logs | ❌ Missing | Need ABDM-compliant logging |
| ABDM Token Cache | ❌ Missing | Need gateway token management |
| Callback URLs | ❌ Missing | Need public callback endpoints |

### Milestone 3: HIU (Health Information User)

| Feature | Status | Notes |
|---------|--------|-------|
| HIU Registration on ABDM | ❌ Missing | Need separate HIU registration |
| Patient Consent Requests | ❌ Missing | Need HIU consent flow |
| Data Fetch from HIP | ❌ Missing | Need data request/poll flow |
| FHIR Data Consumption | ❌ Missing | Need FHIR parsing/display |
| Consent Artefact Management | ❌ Missing | Need full consent lifecycle |
| Cross-HIP Data Aggregation | ❌ Missing | Need multi-HIP data merging |
| HIU-Specific Audit Logs | ❌ Missing | Need separate audit trail |

### General ABDM Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| RSA Key Pair (2048-bit) | ❌ Missing | Required for ABDM gateway auth |
| ECDH Key Exchange | ❌ Missing | Required for encryption |
| ABDM Gateway Base URL config | ❌ Missing | Need env vars |
| ABDM Client ID/Secret | ❌ Missing | Need after HPR registration |
| JWT for ABDM Gateway | ❌ Missing | Need gateway-specific JWT |
| ABDM API Response Caching | ❌ Missing | Token cache, profile cache |
| Public HTTPS Endpoint | ❌ Missing | Required for ABDM callbacks |
| `.well-known/` endpoints | ❌ Missing | Required for ABDM discovery |

---

## 9. Required File Changes

### Backend Files Needing Modification
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `abhaNumber`, `abhaAddress`, `abhaVerified` to Patient model; add new models (AbhaProfile, ConsentArtefact, CareContext, FhirResourceLog, AbdmAuditLog, AbdmTokenCache) |
| `backend/src/app.js` | Mount `/api/abdm` routes |
| `backend/.env.example` | Add ABDM gateway config vars |
| `backend/src/modules/receptionist/patients/patients.controller.js` | Add ABHA fields to patient create/update |
| `backend/src/modules/receptionist/patients/patients.routes.js` | Add ABHA-related routes |
| `backend/src/modules/patient/patientAuth.controller.js` | Add ABHA to self-registration |
| `backend/src/middleware/roleMiddleware.js` | Possibly add ABDM-specific role |
| `backend/server.js` | Add HTTPS support, startup ABDM health check |

### Frontend Files Needing Modification
| File | Change |
|------|--------|
| `frontend/src/services/abdm/abhaService.js` | Update to call real backend endpoints |
| `frontend/src/components/abdm/AbhaVerificationModal.jsx` | Connect to actual patient registration flow |
| `frontend/src/pages/receptionist/patients/PatientRegistration.jsx` | Integrate ABHA verification button |
| `frontend/src/pages/patient/PatientProfile.jsx` | Show ABHA info |
| `frontend/.env.example` | May need to add ABDM-specific URLs |
| `frontend/src/utils/api.js` | Maybe add ABDM-specific axios instance |

---

## 10. New Files Required

### Backend — New ABDM Module
```
backend/src/modules/abdm/
├── abdm.routes.js              # All /api/abdm/* routes
├── abha.controller.js          # ABHA create/verify/search/generate
├── hip.controller.js           # HIP-specific endpoints (care context, consent, data push)
├── hiu.controller.js           # HIU-specific endpoints (consent request, data fetch)
├── gateway.controller.js       # ABDM gateway communication
├── fhir.controller.js          # FHIR resource generation & mapping
├── consent.controller.js       # Consent artefact management
├── callback.controller.js      # Callback URL handlers
├── abdmAuth.service.js         # Gateway JWT, token caching, session management
├── abha.service.js             # ABHA number integration logic
├── hip.service.js              # HIP registration, certificate management
├── hiu.service.js              # HIU registration, data request handling
├── fhir.service.js             # FHIR resource mapping & validation
├── encryption.service.js       # RSA, ECDH, field-level encryption
├── consent.service.js          # Consent artefact lifecycle
├── careContext.service.js      # Care context creation & management
├── gateway.service.js          # ABDM Gateway API client
├── callback.service.js         # Callback URL registration & handling
├── abdmLogger.service.js       # ABDM-compliant audit logging
├── fhir/
│   ├── patient.fhir.js         # Patient → FHIR Patient resource
│   ├── consultation.fhir.js    # Consultation → FHIR Encounter
│   ├── admission.fhir.js       # Admission → FHIR Encounter
│   ├── lab.fhir.js             # LabOrder → FHIR DiagnosticReport
│   ├── medication.fhir.js      # Prescription → FHIR MedicationRequest
│   ├── vitals.fhir.js          # Vitals → FHIR Observation
│   └── fhir.utils.js           # Shared FHIR helpers
├── templates/
│   ├── hip-notification.xml    # HIP notification XML template
│   └── health-information.xml  # Health information data XML template
└── README.md                   # ABDM module documentation
```

### Backend — Config
```
backend/src/config/abdm.js      # ABDM gateway config (URLs, certificates, client credentials)
```

### Backend — Middleware
```
backend/src/middleware/abdmAuth.middleware.js   # ABDM gateway JWT verification
```

### Frontend — New Pages/Components
```
frontend/src/pages/abdm/
├── AbhaLinkingPage.jsx         # ABHA linking page for patients
├── ConsentHistory.jsx          # View consent artefact history
└── CareContextView.jsx         # View linked care contexts
```

---

## 11. Development Roadmap

### Phase 0: Prerequisites (1-2 days)
| Step | Task | Files |
|------|------|-------|
| 0.1 | Research ABDM sandbox API, get credentials, test connectivity | — |
| 0.2 | Add `abhaNumber`, `abhaAddress`, `abhaVerified` to Patient model | `schema.prisma` |
| 0.3 | Create `AbhaProfile`, `CareContext`, `ConsentArtefact`, `AwarenessLog` models | `schema.prisma` |
| 0.4 | Generate Prisma migration & deploy | `npx prisma migrate dev` |
| 0.5 | Add ABDM config vars to backend `.env` | `.env.example`, `config/abdm.js` |
| 0.6 | Create ABDM module folder structure | All new files above |
| 0.7 | Implement RSA 2048-bit key pair generation & storage | `encryption.service.js` |

### Phase 1: Milestone 1 — ABHA (2-3 days)
| Step | Task |
|------|------|
| 1.1 | Set up environment variables for ABDM base URLs |
| 1.2 | Implement ABDM Gateway JWT authentication |
| 1.3 | ABHA send OTP API (`POST /api/abdm/abha/send-otp`) |
| 1.4 | ABHA verify OTP API (`POST /api/abdm/abha/verify-otp`) |
| 1.5 | ABHA search by demographic API (`POST /api/abdm/abha/search`) |
| 1.6 | ABHA create/generate API (`POST /api/abdm/abha/create`) |
| 1.7 | ABHA profile fetch API (`GET /api/abdm/abha/profile`) |
| 1.8 | Update frontend `abhaService.js` to call real backend APIs |
| 1.9 | Integrate ABHA verification into reception patient registration form |
| 1.10 | Add ABHA fields to patient create/update APIs |
| 1.11 | Add ABHA display on patient details page |
| 1.12 | Add ABHA linking in patient portal profile page |

### Phase 2: Milestone 2 — HIP (5-7 days)
| Step | Task |
|------|------|
| 2.1 | Register HIP on ABDM sandbox (get client ID/secret) |
| 2.2 | Implement ABDM gateway auth client (token caching, refresh) |
| 2.3 | Build care context creation API (`POST /api/abdm/care-context`) |
| 2.4 | Build care context discovery API |
| 2.5 | Create FHIR Patient resource mapper |
| 2.6 | Create FHIR Encounter resource mapper (OPD consult, IPD admission) |
| 2.7 | Create FHIR Observation mapper (vitals) |
| 2.8 | Create FHIR DiagnosticReport mapper (lab) |
| 2.9 | Create FHIR MedicationRequest mapper (prescriptions) |
| 2.10 | Implement consent artefact management (fetch, notify, on-request) |
| 2.11 | Implement HIP data push notification API |
| 2.12 | Implement HIP data on-request (polling) API |
| 2.13 | Build callback URL endpoint for ABDM gateway |
| 2.14 | Implement HIP audit logging (ABDM-compliant) |
| 2.15 | Test end-to-end HIP flow with ABDM sandbox |

### Phase 3: Milestone 3 — HIU (3-5 days)
| Step | Task |
|------|------|
| 3.1 | Register HIU on ABDM sandbox (get client ID/secret) |
| 3.2 | Implement consent request creation API |
| 3.3 | Implement consent request notification handler |
| 3.4 | Implement HIU data fetch API (from HIP via gateway) |
| 3.5 | Build FHIR data consumer/display for patient portal |
| 3.6 | Implement cross-HIP data aggregation |
| 3.7 | Add consent artefact status tracking UI |
| 3.8 | Implement HIU audit logging |
| 3.9 | Test end-to-end HIU flow with ABDM sandbox |

### Phase 4: Production Readiness (2-3 days)
| Step | Task |
|------|------|
| 4.1 | Production HPR registration on ABDM gateway |
| 4.2 | HTTPS certificate configuration |
| 4.3 | Public callback URL setup |
| 4.4 | `.well-known/` endpoints for ABDM discovery |
| 4.5 | Rate limiting implementation |
| 4.6 | Comprehensive error handling & retry logic |
| 4.7 | Full integration testing |
| 4.8 | Documentation |
