"""
db_init.py — HR Offer Letter System
====================================
Run this ONCE after setting up your MongoDB Atlas cluster.

Usage:
    cd backend
    python db_init.py

What it does:
    1. Connects to MongoDB using your .env MONGO_URI
    2. Creates all 8 collections with JSON schema validation
    3. Creates all performance indexes
    4. Seeds 4 demo user accounts (admin, hr, manager, hr_head)
    5. Creates the employee ID counter document
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load .env from the backend folder
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from pymongo.errors import CollectionInvalid, OperationFailure
    import bcrypt
except ImportError as e:
    print(f"\n❌ Missing dependency: {e}")
    print("   Run: pip install -r requirements.txt\n")
    sys.exit(1)

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/hr_offer_letters')

# ─────────────────────────────────────────────────────────────────────────────
# Collection Schemas (MongoDB JSON Schema Validation)
# ─────────────────────────────────────────────────────────────────────────────

SCHEMAS = {

    # ── users ──────────────────────────────────────────────────────────────
    # Stores all login accounts: admin, hr, hr_head, manager, employee
    "users": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["name", "email", "password", "role", "created_at"],
                "properties": {
                    "name":         {"bsonType": "string", "description": "Full name"},
                    "email":        {"bsonType": "string", "description": "Login email (unique)"},
                    "password":     {"bsonType": "binData", "description": "bcrypt hashed password"},
                    "role":         {
                        "bsonType": "string",
                        "enum": ["admin", "hr", "hr_head", "manager", "employee"],
                        "description": "User role controlling access"
                    },
                    "employee_ref": {"bsonType": "string", "description": "ObjectId of linked employee record"},
                    "emp_code":     {"bsonType": "string", "description": "Employee code e.g. EMP001"},
                    "is_active":    {"bsonType": "bool",   "description": "False = account deactivated"},
                    "phone":                    {"bsonType": "string"},
                    "personal_email":           {"bsonType": "string"},
                    "address":                  {"bsonType": "string"},
                    "birthday":                 {"bsonType": "string"},
                    "anniversary":              {"bsonType": "string"},
                    "emergency_contact_name":   {"bsonType": "string"},
                    "emergency_contact_phone":  {"bsonType": "string"},
                    "emergency_contact_relation": {"bsonType": "string"},
                    "blood_group":              {"bsonType": "string"},
                    "gender":                   {"bsonType": "string"},
                    "created_at":   {"bsonType": "date"},
                    "updated_at":   {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",  # moderate = existing docs not re-validated
    },

    # ── employees ──────────────────────────────────────────────────────────
    # HR employee records — the source of truth for offer letter placeholders
    "employees": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["name", "designation", "employee_id", "created_at"],
                "properties": {
                    "employee_id":      {"bsonType": "string", "description": "Auto-generated e.g. EMP001"},
                    "name":             {"bsonType": "string"},
                    "designation":      {"bsonType": "string"},
                    "department":       {"bsonType": "string"},
                    "email":            {"bsonType": "string"},
                    "phone":            {"bsonType": "string"},
                    "address":          {"bsonType": "string"},
                    "joining_date":     {"bsonType": "string", "description": "DD-MM-YYYY format"},
                    "ctc":              {"bsonType": ["double", "int", "string", "null"]},
                    "basic":            {"bsonType": ["double", "int", "string", "null"]},
                    "hra":              {"bsonType": ["double", "int", "string", "null"]},
                    "da":               {"bsonType": ["double", "int", "string", "null"]},
                    "allowances":       {"bsonType": ["double", "int", "string", "null"]},
                    "probation_period": {"bsonType": ["int", "string", "null"], "description": "Months, default 6"},
                    "notice_period":    {"bsonType": ["int", "string", "null"], "description": "Days, default 30"},
                    "status": {
                        "bsonType": "string",
                        "enum": ["active", "notice_period", "clearance_pending", "clearance_complete", "exited", "inactive"],
                        "description": "Employment lifecycle status"
                    },
                    "exit_date":        {"bsonType": ["string", "null"]},
                    "deactivated_by":   {"bsonType": ["string", "null"]},
                    "deactivated_at":   {"bsonType": ["string", "null"]},
                    "created_at":       {"bsonType": "date"},
                    "updated_at":       {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

    # ── templates ──────────────────────────────────────────────────────────
    # DOCX template files uploaded by Admin — used to generate letters
    "templates": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["name", "type", "file_path", "uploaded_by", "created_at"],
                "properties": {
                    "name":        {"bsonType": "string", "description": "Display name e.g. 'Standard Offer 2026'"},
                    "type": {
                        "bsonType": "string",
                        "enum": ["offer", "relieving", "appointment_order", "experience", "other"],
                        "description": "Letter type this template is used for"
                    },
                    "file_path":   {"bsonType": "string", "description": "Absolute path to .docx file on server"},
                    "filename":    {"bsonType": "string"},
                    "is_active":   {"bsonType": "bool",   "description": "Only one active template per type recommended"},
                    "uploaded_by": {"bsonType": "string", "description": "User ObjectId who uploaded"},
                    "created_at":  {"bsonType": "date"},
                    "updated_at":  {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

    # ── letters ────────────────────────────────────────────────────────────
    # Generated offer/relieving letters going through approval workflow
    "letters": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["employee_id", "letter_type", "status", "created_by", "created_at"],
                "properties": {
                    "employee_id":  {"bsonType": "string", "description": "ObjectId of employee"},
                    "template_id":  {"bsonType": "string", "description": "ObjectId of template used"},
                    "letter_type": {
                        "bsonType": "string",
                        "enum": ["offer", "relieving", "experience", "other"],
                    },
                    "status": {
                        "bsonType": "string",
                        "enum": ["draft", "pending_manager", "pending_hr_head", "approved", "rejected"],
                    },
                    "version":      {"bsonType": "int",    "description": "Increments on each regeneration"},
                    "context":      {"bsonType": "object", "description": "Placeholder key→value map used for generation"},
                    "breakdown":    {"bsonType": "object", "description": "Salary breakdown details"},
                    "docx_path":    {"bsonType": "string", "description": "Server path to generated .docx"},
                    "pdf_path":     {"bsonType": "string", "description": "Server path to generated .pdf"},
                    "approval_history": {
                        "bsonType": "array",
                        "description": "Array of approval events",
                        "items": {
                            "bsonType": "object",
                            "properties": {
                                "user_id":   {"bsonType": "string"},
                                "user_name": {"bsonType": "string"},
                                "role":      {"bsonType": "string"},
                                "action":    {"bsonType": "string"},
                                "from":      {"bsonType": "string"},
                                "to":        {"bsonType": "string"},
                                "remarks":   {"bsonType": "string"},
                                "timestamp": {"bsonType": "string"},
                            }
                        }
                    },
                    "created_by":   {"bsonType": "string", "description": "User ObjectId who created"},
                    "created_at":   {"bsonType": "date"},
                    "updated_at":   {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

    # ── appointment_orders ─────────────────────────────────────────────────
    # Appointment orders: draft → pending_hr_head → approved/rejected
    "appointment_orders": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["employee_id", "status", "created_by", "created_at"],
                "properties": {
                    "employee_id":       {"bsonType": "string"},
                    "template_id":       {"bsonType": "string"},
                    "reference_number":  {"bsonType": "string", "description": "e.g. AO-EMP001-001"},
                    "status": {
                        "bsonType": "string",
                        "enum": ["draft", "pending_hr_head", "approved", "rejected"],
                    },
                    "details":       {"bsonType": "object", "description": "Fields filled by employee"},
                    "docx_path":     {"bsonType": "string"},
                    "pdf_path":      {"bsonType": "string"},
                    "approval_history": {"bsonType": "array"},
                    "created_by":    {"bsonType": "string"},
                    "created_at":    {"bsonType": "date"},
                    "updated_at":    {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

    # ── exit_records ───────────────────────────────────────────────────────
    # Tracks the exit process for employees leaving the company
    "exit_records": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["employee_id", "status", "created_at"],
                "properties": {
                    "employee_id":     {"bsonType": "string"},
                    "status": {
                        "bsonType": "string",
                        "enum": ["notice_period", "clearance_pending", "clearance_complete", "exited"],
                    },
                    "last_working_day": {"bsonType": "string"},
                    "reason":           {"bsonType": "string"},
                    "clearance_items":  {"bsonType": "array"},
                    "remarks":          {"bsonType": "string"},
                    "initiated_by":     {"bsonType": "string"},
                    "created_at":       {"bsonType": "date"},
                    "updated_at":       {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

    # ── documents ──────────────────────────────────────────────────────────
    # Employee KYC documents: Aadhaar, PAN, degree, photo, etc.
    "documents": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "doc_type", "status", "uploaded_at"],
                "properties": {
                    "user_id":   {"bsonType": "string", "description": "JWT identity (user ObjectId string)"},
                    "doc_type": {
                        "bsonType": "string",
                        "description": "e.g. photo, aadhaar, pan, resume, degree, bank_passbook"
                    },
                    "filename":            {"bsonType": "string"},
                    "path":                {"bsonType": "string", "description": "Absolute server file path"},
                    "url":                 {"bsonType": "string", "description": "Relative URL to serve file"},
                    "status": {
                        "bsonType": "string",
                        "enum": ["uploaded", "verified", "rejected"],
                    },
                    "extracted_fields":    {"bsonType": "object", "description": "OCR-extracted data"},
                    "verified_fields":     {"bsonType": "object", "description": "Employee-confirmed data"},
                    "extraction_verified": {"bsonType": "bool"},
                    "verified_at":         {"bsonType": "date"},
                    "uploaded_at":         {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

    # ── doc_submissions ────────────────────────────────────────────────────
    # Submission records when employee submits all docs for HR review
    "doc_submissions": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "status", "submitted_at"],
                "properties": {
                    "user_id":      {"bsonType": "string"},
                    "status": {
                        "bsonType": "string",
                        "enum": ["pending_hr", "approved", "rejected"],
                    },
                    "remarks":      {"bsonType": "string", "description": "HR feedback on reject"},
                    "reviewed_by":  {"bsonType": "string", "description": "HR user ObjectId"},
                    "reviewed_at":  {"bsonType": "date"},
                    "submitted_at": {"bsonType": "date"},
                }
            }
        },
        "validationLevel": "moderate",
    },

}


# ─────────────────────────────────────────────────────────────────────────────
# Indexes for each collection
# ─────────────────────────────────────────────────────────────────────────────

INDEXES = {
    "users": [
        {"keys": [("email", ASCENDING)], "unique": True, "name": "idx_users_email_unique"},
        {"keys": [("role", ASCENDING)],  "name": "idx_users_role"},
        {"keys": [("employee_ref", ASCENDING)], "sparse": True, "name": "idx_users_employee_ref"},
    ],
    "employees": [
        {"keys": [("employee_id", ASCENDING)], "unique": True, "name": "idx_employees_emp_id_unique"},
        {"keys": [("status", ASCENDING)], "name": "idx_employees_status"},
        {"keys": [("email", ASCENDING)],  "sparse": True, "name": "idx_employees_email"},
        {"keys": [("name", ASCENDING)],   "name": "idx_employees_name"},
        {"keys": [("created_at", DESCENDING)], "name": "idx_employees_created_desc"},
    ],
    "templates": [
        {"keys": [("type", ASCENDING), ("is_active", ASCENDING)], "name": "idx_templates_type_active"},
        {"keys": [("created_at", DESCENDING)], "name": "idx_templates_created_desc"},
    ],
    "letters": [
        {"keys": [("employee_id", ASCENDING)], "name": "idx_letters_employee"},
        {"keys": [("status", ASCENDING)],      "name": "idx_letters_status"},
        {"keys": [("letter_type", ASCENDING)], "name": "idx_letters_type"},
        {"keys": [("employee_id", ASCENDING), ("letter_type", ASCENDING), ("version", DESCENDING)], "name": "idx_letters_emp_type_ver"},
        {"keys": [("created_at", DESCENDING)], "name": "idx_letters_created_desc"},
    ],
    "appointment_orders": [
        {"keys": [("employee_id", ASCENDING)], "name": "idx_ao_employee"},
        {"keys": [("status", ASCENDING)],      "name": "idx_ao_status"},
        {"keys": [("reference_number", ASCENDING)], "sparse": True, "name": "idx_ao_ref_number"},
        {"keys": [("created_at", DESCENDING)], "name": "idx_ao_created_desc"},
    ],
    "exit_records": [
        {"keys": [("employee_id", ASCENDING)], "name": "idx_exit_employee"},
        {"keys": [("status", ASCENDING)],      "name": "idx_exit_status"},
        {"keys": [("created_at", DESCENDING)], "name": "idx_exit_created_desc"},
    ],
    "documents": [
        {"keys": [("user_id", ASCENDING), ("doc_type", ASCENDING)], "unique": True, "name": "idx_docs_user_doctype_unique"},
        {"keys": [("user_id", ASCENDING)], "name": "idx_docs_user"},
        {"keys": [("uploaded_at", DESCENDING)], "name": "idx_docs_uploaded_desc"},
    ],
    "doc_submissions": [
        {"keys": [("user_id", ASCENDING), ("submitted_at", DESCENDING)], "name": "idx_subs_user_date"},
        {"keys": [("status", ASCENDING)], "name": "idx_subs_status"},
        {"keys": [("submitted_at", DESCENDING)], "name": "idx_subs_submitted_desc"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Demo seed users
# ─────────────────────────────────────────────────────────────────────────────

SEED_USERS = [
    {
        "name":       "Admin User",
        "email":      "admin@company.com",
        "password":   bcrypt.hashpw(b"admin123", bcrypt.gensalt()),
        "role":       "admin",
        "is_active":  True,
        "created_at": datetime.utcnow(),
    },
    {
        "name":       "HR Executive",
        "email":      "hr@company.com",
        "password":   bcrypt.hashpw(b"hr123", bcrypt.gensalt()),
        "role":       "hr",
        "is_active":  True,
        "created_at": datetime.utcnow(),
    },
    {
        "name":       "HR Manager",
        "email":      "hrhead@company.com",
        "password":   bcrypt.hashpw(b"hrhead123", bcrypt.gensalt()),
        "role":       "hr_head",
        "is_active":  True,
        "created_at": datetime.utcnow(),
    },
    {
        "name":       "Dept Manager",
        "email":      "manager@company.com",
        "password":   bcrypt.hashpw(b"manager123", bcrypt.gensalt()),
        "role":       "manager",
        "is_active":  True,
        "created_at": datetime.utcnow(),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Main setup function
# ─────────────────────────────────────────────────────────────────────────────

def run_setup():
    print("\n" + "="*60)
    print("  HR Offer Letter System — Database Initializer")
    print("="*60)

    # ── Connect ──────────────────────────────────────────────────────────
    print(f"\n🔌 Connecting to MongoDB...")
    print(f"   URI: {MONGO_URI[:50]}...")

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
        client.admin.command('ping')
        print("   ✅ Connected successfully!")
    except Exception as e:
        print(f"\n❌ Could not connect to MongoDB:\n   {e}")
        print("\n💡 Tips:")
        print("   - Check your MONGO_URI in backend/.env")
        print("   - Make sure your IP is whitelisted in Atlas → Network Access")
        print("   - Make sure the username/password in the URI is correct")
        sys.exit(1)

    # Get database name from URI, fall back to default
    db_name = "hr_offer_letters"
    if "/" in MONGO_URI:
        part = MONGO_URI.split("/")[-1].split("?")[0].strip()
        if part:
            db_name = part

    db = client[db_name]
    print(f"\n📦 Using database: '{db_name}'")

    # ── Create Collections ────────────────────────────────────────────────
    print("\n📋 Creating collections with schema validation...")
    existing = db.list_collection_names()

    for coll_name, options in SCHEMAS.items():
        if coll_name in existing:
            # Update validator on existing collection
            try:
                db.command("collMod", coll_name, **options)
                print(f"   ✏️  {coll_name:25s} — updated validator")
            except OperationFailure as e:
                print(f"   ⚠️  {coll_name:25s} — could not update: {e}")
        else:
            try:
                db.create_collection(coll_name, **options)
                print(f"   ✅ {coll_name:25s} — created")
            except CollectionInvalid:
                print(f"   ⏭️  {coll_name:25s} — already exists (skipped)")

    # ── Create Indexes ────────────────────────────────────────────────────
    print("\n🔍 Creating indexes...")
    for coll_name, idx_list in INDEXES.items():
        coll = db[coll_name]
        for idx in idx_list:
            keys    = idx["keys"]
            options = {k: v for k, v in idx.items() if k != "keys"}
            try:
                coll.create_index(keys, **options)
                print(f"   ✅ {coll_name}.{idx.get('name', str(keys))}")
            except Exception as e:
                print(f"   ⚠️  {coll_name}.{idx.get('name')} — {e}")

    # ── Employee ID Counter ───────────────────────────────────────────────
    print("\n🔢 Setting up employee ID counter...")
    counters = db["counters"]
    if not counters.find_one({"_id": "employee_id"}):
        counters.insert_one({"_id": "employee_id", "seq": 0})
        print("   ✅ Employee ID counter created (starts at EMP001)")
    else:
        print("   ⏭️  Counter already exists (skipped)")

    # ── Seed Users ────────────────────────────────────────────────────────
    print("\n👤 Seeding demo user accounts...")
    seeded = 0
    skipped = 0
    for u in SEED_USERS:
        if db.users.find_one({"email": u["email"]}):
            print(f"   ⏭️  {u['email']:35s} — already exists (skipped)")
            skipped += 1
        else:
            db.users.insert_one(u)
            print(f"   ✅ {u['email']:35s} — created ({u['role']})")
            seeded += 1

    # ── Done ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  ✅ Database setup complete!")
    print("="*60)
    print(f"\n   Collections : {len(SCHEMAS)}")
    print(f"   Indexes     : {sum(len(v) for v in INDEXES.values())}")
    print(f"   Users seeded: {seeded} new, {skipped} already existed")
    print(f"\n   📌 Database name: {db_name}")
    print(f"   📌 Atlas dashboard: https://cloud.mongodb.com")
    print("\n   🚀 You can now start your backend:")
    print("      python app.py\n")

    print("   🔐 Login with:")
    print("      admin@company.com   / admin123   (Admin)")
    print("      hr@company.com      / hr123      (HR)")
    print("      manager@company.com / manager123 (Manager)")
    print("      hrhead@company.com  / hrhead123  (HR Head)")
    print()


if __name__ == "__main__":
    run_setup()