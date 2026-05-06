# HR Offer Letter Automation System

Internal tool for generating, approving, and managing **offer letters** — built with Flask + React + MongoDB.

---

## Architecture

```
React (port 3000)  ←→  Flask API (port 5000)  ←→  MongoDB (port 27017)
                              ↓
                     DOCX/PDF Generation (python-docx + LibreOffice)
```

---

## Quick Start (Local Dev)

### Prerequisites
- Python 3.10+, Node.js 18+, MongoDB running locally
- LibreOffice (optional — for PDF output)

### 1. Backend
```bash
cd backend
cp .env.example .env          # edit JWT_SECRET_KEY
pip install -r requirements.txt
python app.py                 # → http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm start                     # → http://localhost:3000
```

### 3. Seed demo users
In the browser: click **Seed DB** on the login page, or:
```bash
curl -X POST http://localhost:5000/api/auth/seed
```

---

## Docker (Recommended)

```bash
docker-compose up --build
# App: http://localhost:3000
```

---

## Demo Accounts

| Role     | Email                   | Password      | Can Do                            |
|----------|-------------------------|---------------|-----------------------------------|
| Admin    | admin@company.com       | admin123      | Everything + template management  |
| HR       | hr@company.com          | hr123         | Add employees, generate letters   |
| Manager  | manager@company.com     | manager123    | First-stage approval              |
| HR Head  | hrhead@company.com      | hrhead123     | Final approval                    |

---

## Offer Letter Workflow

```
HR logs in
  → Adds employee (name, designation, CTC, joining date, etc.)
  → Uploads DOCX template (Admin only)
  → Generates offer letter  [status: draft]
  → Submits for approval    [status: pending_manager]

Manager logs in
  → Reviews → Approves      [status: pending_hr_head]
     OR Rejects             [status: rejected]

HR Head logs in
  → Final review → Approves [status: approved]  ← letter is now official
     OR Rejects             [status: rejected]

HR downloads final DOCX / PDF
```

---

## Template Placeholders

Create a `.docx` file using these `{{placeholder}}` tokens:

| Placeholder              | Value Source                     |
|--------------------------|----------------------------------|
| `{{employee_name}}`      | Employee record                  |
| `{{employee_id}}`        | Employee record                  |
| `{{designation}}`        | Employee record                  |
| `{{department}}`         | Employee record                  |
| `{{ctc}}`                | Employee record                  |
| `{{basic}}`              | Employee record                  |
| `{{hra}}`                | Employee record                  |
| `{{allowances}}`         | Employee record                  |
| `{{joining_date}}`       | Employee record                  |
| `{{address}}`            | Employee record                  |
| `{{probation_period}}`   | Employee record (default: 6)     |
| `{{notice_period}}`      | Employee record (default: 30)    |
| `{{company_name}}`       | Set at generation time           |
| `{{hr_signatory_name}}`  | Set at generation time           |
| `{{hr_signatory_designation}}` | Set at generation time     |
| `{{date}}`               | Auto-set to today's date         |

A ready-to-use sample template is at: `backend/templates_docx/offer_letter_template.docx`

---

## API Reference

```
POST /api/auth/login          Login
GET  /api/auth/me             Current user
POST /api/auth/seed           Seed demo users

GET  /api/employees/          List employees
POST /api/employees/          Create employee
PUT  /api/employees/:id       Update employee
POST /api/employees/bulk-upload  CSV import

GET  /api/templates/          List offer templates
POST /api/templates/upload    Upload DOCX template (Admin)
POST /api/templates/:id/toggle  Activate/deactivate

GET  /api/letters/            List offer letters
POST /api/letters/generate    Generate letter from template
POST /api/letters/:id/submit  Submit draft for approval
GET  /api/letters/:id/download?format=docx|pdf

GET  /api/approvals/pending   Letters pending your action
GET  /api/approvals/history   Approved/rejected letters
POST /api/approvals/:id/action  { action: approve|reject, remarks }
GET  /api/approvals/stats     Status counts
```

---

## File Storage Layout

```
backend/storage/
  templates/
    offer_v1_my_template.docx
    offer_v2_updated.docx
  letters/
    2026/
      EMP001_offer_v1.docx
      EMP001_offer_v1.pdf
```
