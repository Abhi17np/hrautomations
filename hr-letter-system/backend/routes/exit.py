from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
import os

from services.letter_generator import generate_letter_docx, generate_letter_pdf

exit_bp = Blueprint('exit', __name__)

EXIT_STATUSES = ['notice_period', 'clearance_pending', 'clearance_complete']
CLEARANCE_KEYS = ['it_assets', 'finance', 'admin', 'hr_docs', 'access_cards']

def serialize(emp):
    emp['_id'] = str(emp['_id'])
    return emp


@exit_bp.route('/', methods=['GET'])
@jwt_required()
def list_exit_employees():
    """List all employees currently in the exit pipeline."""
    db = current_app.db
    employees = list(db.employees.find(
        {'status': {'$in': EXIT_STATUSES + ['exited']}},
        sort=[('updated_at', -1)]
    ))
    return jsonify([serialize(e) for e in employees])


@exit_bp.route('/relieving/generate', methods=['POST'])
@jwt_required()
def generate_relieving():
    """
    Generate a relieving letter for an employee.
    HARD GATE: all 5 clearances must be confirmed. Cannot be bypassed.
    """
    db      = current_app.db
    uid     = get_jwt_identity()
    data    = request.json or {}

    emp_id  = data.get('employee_id')
    tmpl_id = data.get('template_id')

    if not emp_id or not tmpl_id:
        return jsonify({'error': 'employee_id and template_id are required'}), 400

    emp = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    # ── COMPLIANCE GATE ──────────────────────────────────────────────────────
    clearances = emp.get('clearances', {})
    missing    = [k for k in CLEARANCE_KEYS if not clearances.get(k)]
    if missing:
        return jsonify({
            'error': 'Clearance gate blocked. All department clearances must be confirmed first.',
            'missing_clearances': missing,
        }), 403
    # ─────────────────────────────────────────────────────────────────────────

    tmpl = db.templates.find_one({'_id': ObjectId(tmpl_id)})
    if not tmpl:
        return jsonify({'error': 'Template not found'}), 404
    if not tmpl.get('is_active'):
        return jsonify({'error': 'Template is inactive'}), 400

    # Build context
    ctx = {
        'employee_name':             emp.get('name', ''),
        'employee_id':               emp.get('employee_id', ''),
        'designation':               emp.get('designation', ''),
        'department':                emp.get('department', ''),
        'joining_date':              emp.get('joining_date', ''),
        'last_working_day':          emp.get('last_working_day', ''),
        'resignation_date':          emp.get('resignation_date', ''),
        'exit_reason':               emp.get('exit_reason', ''),
        'company_name':              data.get('company_name', 'Acme Corp'),
        'hr_signatory_name':         data.get('hr_signatory_name', 'HR Department'),
        'hr_signatory_designation':  data.get('hr_signatory_designation', 'Human Resources'),
        'date':                      datetime.now().strftime('%d-%m-%Y'),
        **data.get('extra_fields', {}),
    }

    year    = datetime.now().strftime('%Y')
    out_dir = os.path.join(current_app.config['STORAGE_ROOT'], 'letters', year)
    os.makedirs(out_dir, exist_ok=True)

    base      = f"{emp.get('employee_id', emp_id)}_relieving"
    docx_path = os.path.join(out_dir, base + '.docx')
    pdf_path  = os.path.join(out_dir, base + '.pdf')

    try:
        generate_letter_docx(tmpl['file_path'], ctx, docx_path)
    except Exception as e:
        return jsonify({'error': f'Document generation failed: {str(e)}'}), 500

    pdf_result = generate_letter_pdf(docx_path, pdf_path)

    # Record the relieving letter
    doc = {
        'employee_id':      emp_id,
        'template_id':      tmpl_id,
        'letter_type':      'relieving',
        'status':           'issued',
        'approval_history': [],
        'docx_path':        docx_path,
        'pdf_path':         pdf_result,
        'context':          ctx,
        'version':          1,
        'generated_by':     uid,
        'created_at':       datetime.utcnow(),
    }
    result = db.letters.insert_one(doc)

    # Update employee status to exited
    db.employees.update_one(
        {'_id': ObjectId(emp_id)},
        {'$set': {'status': 'exited', 'updated_at': datetime.utcnow()}}
    )

    return jsonify({
        'id':      str(result.inserted_id),
        'has_pdf': pdf_result is not None,
        'message': 'Relieving letter generated. Employee status updated to exited.',
    }), 201