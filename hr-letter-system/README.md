# HR Offer Letter Automation System

Internal tool for generating, approving, and managing **offer letters** — built with Flask + React + MongoDB.

---

## Architecture

```
React (port 3000)  ←→  Flask API (port 5050)  ←→  MongoDB (port 27017)
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
python app.py                 # → http://localhost:5050
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
curl -X POST http://localhost:5050/api/auth/seed
```

---

## Docker (Recommended)

```bash
docker-compose up --build
# App: http://localhost:3000
```

---

## Production Deployment (Google Cloud Platform)

### Option 1: Automated via GitHub Actions (Recommended - No Local Setup)

1. **Create GCP Service Account:**
   - Go to GCP Console > IAM & Admin > Service Accounts
   - Create service account (e.g., `github-deployer`)
   - Grant roles: `Cloud Run Admin`, `Cloud Build Service Account`, `Storage Admin`
   - Create JSON key, download it

2. **Push to GitHub:**
   - Create a GitHub repository
   - Push your code: `git add . && git commit -m "Initial commit" && git push origin main`

3. **Set GitHub Secrets:**
   In your GitHub repo > Settings > Secrets and variables > Actions:
   ```
   GCP_PROJECT_ID: your-gcp-project-id
   GCP_SA_KEY: (paste entire JSON key content)
   MONGO_URI: mongodb+srv://...
   JWT_SECRET_KEY: your-long-secret-key
   SMTP_HOST: smtp.gmail.com
   SMTP_PORT: 587
   SMTP_USER: your-email@gmail.com
   SMTP_PASS: your-app-password
   SMTP_FROM: your-email@gmail.com
   COMPANY_NAME: Your Company Name
   ```

4. **Deploy:**
   - Push to `main` branch or manually trigger in Actions tab
   - Wait for deployment (5-10 minutes)
   - Get URLs from Cloud Run console or workflow logs

### Option 2: Manual via GCP Console

1. Enable Cloud Run and Cloud Build APIs
2. Go to Cloud Run > Create Service
3. Choose "Deploy from source"
4. Connect your GitHub repo
5. Select branch, set build settings
6. Configure environment variables as above

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
