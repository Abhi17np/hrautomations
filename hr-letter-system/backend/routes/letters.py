"""
letters.py — Complete Offer Letter module
New features vs previous version:
  - CTC breakdown calculator (Basic/HRA/DA/DA/PF/GHI/Other)
  - letter_subtype: 'new' | 'revised'
  - Direct-to-HR-Head approval flow (no manager stage)
  - HR Head inline edit before approval
  - Send email to candidate after approval
  - Confirm join + Create employee login ID (role='employee')
"""

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
import os, smtplib, bcrypt, logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from services.letter_generator import generate_letter_docx, generate_letter_pdf

letters_bp = Blueprint('letters', __name__)
log = logging.getLogger(__name__)

ACTIVE_STATUSES    = {'draft', 'pending_hr_head', 'rejected', 'approved', 'issued'}
COMPLETED_STATUSES = {'joined', 'withdrawn'}
DELETABLE_STATUSES = {'draft', 'rejected'}
DELETE_ROLES       = {'admin', 'hr_head'}


# ── CTC Calculator ────────────────────────────────────────────────────────────

def calculate_ctc_breakdown(annual_ctc, avail_pf=True, ghi_annual=0.0, metro=False):
    """
    Indian payroll salary breakdown from annual CTC (all amounts in INR).
    Basic = 48% of CTC
    HRA   = 40% of Basic (non-metro) | 50% (metro)
    DA    = 20% of Basic
    Employer PF = min(12% of monthly Basic, 1800) * 12  [if opted in]
    GHI   = user-supplied annual premium
    Other = CTC - Basic - HRA - DA - PF - GHI  (absorbs remainder)
    """
    ctc          = float(annual_ctc)
    basic_a      = round(ctc * 0.48)
    basic_m      = round(basic_a / 12)
    hra_a        = round(basic_a * (0.50 if metro else 0.40))
    hra_m        = round(hra_a / 12)
    da_a         = round(basic_a * 0.20)
    da_m         = round(da_a / 12)
    pf_m         = 1800 if avail_pf else 0
    pf_a         = pf_m * 12
    ghi_a        = round(float(ghi_annual or 0))
    ghi_m        = round(ghi_a / 12)
    other_a      = max(0, int(ctc) - basic_a - hra_a - da_a - pf_a - ghi_a)
    other_m      = round(other_a / 12)
    gross_m      = basic_m + hra_m + da_m + other_m
    net_a        = basic_a + hra_a + da_a + other_a
    return {
        'ctc': ctc, 'basic': basic_a, 'hra': hra_a, 'da': da_a,
        'employer_pf': pf_a, 'ghi': ghi_a, 'other_allowances': other_a,
        'net_annual': net_a, 'gross_monthly': gross_m,
        'basic_monthly': basic_m, 'hra_monthly': hra_m, 'da_monthly': da_m,
        'employer_pf_monthly': pf_m, 'ghi_monthly': ghi_m,
        'other_allowances_monthly': other_m,
        'avail_pf': avail_pf, 'metro': metro,
    }


def _inr(n):
    return f"Rs.{int(n or 0):,}"


def _ctc_to_ctx(ctx, bd):
    prof_tax_m  = 200
    emp_pf_m    = bd['employer_pf_monthly'] if bd['avail_pf'] else 0
    total_ded_m = emp_pf_m + prof_tax_m
    total_ded_y = total_ded_m * 12
    net_pay_m   = bd['gross_monthly'] - total_ded_m
    net_pay_y   = net_pay_m * 12
    additions_m = bd['employer_pf_monthly'] + bd['ghi_monthly']
    additions_y = bd['employer_pf'] + bd['ghi']
    total_ctc_m = round(bd['ctc'] / 12)

    ctx.update({
        'ctc':                      str(int(bd['ctc'])),
        'basic':                    str(bd['basic']),
        'hra':                      str(bd['hra']),
        'da':                       str(bd['da']),
        'employer_pf':              str(bd['employer_pf']),
        'ghi':                      str(bd['ghi']),
        'other_allowances':         str(bd['other_allowances']),
        'gross_monthly':            str(bd['gross_monthly']),
        'net_annual':               str(bd['net_annual']),
        'basic_monthly':            str(bd['basic_monthly']),
        'hra_monthly':              str(bd['hra_monthly']),
        'da_monthly':               str(bd['da_monthly']),
        'employer_pf_monthly':      str(bd['employer_pf_monthly']),
        'other_allowances_monthly': str(bd['other_allowances_monthly']),
        'ctc_fmt':                  _inr(bd['ctc']),
        'basic_fmt':                _inr(bd['basic']),
        'hra_fmt':                  _inr(bd['hra']),
        'da_fmt':                   _inr(bd['da']),
        'employer_pf_fmt':          _inr(bd['employer_pf']),
        'ghi_fmt':                  _inr(bd['ghi']),
        'other_allowances_fmt':     _inr(bd['other_allowances']),
        'gross_monthly_fmt':        _inr(bd['gross_monthly']),
        'net_annual_fmt':           _inr(bd['net_annual']),
        # Annexure table placeholders
        'basic_m':       _inr(bd['basic_monthly']),
        'basic_y':       _inr(bd['basic']),
        'hra_m':         _inr(bd['hra_monthly']),
        'hra_y':         _inr(bd['hra']),
        'da_m':          _inr(bd['da_monthly']),
        'da_y':          _inr(bd['da']),
        'other_m':       _inr(bd['other_allowances_monthly']),
        'other_y':       _inr(bd['other_allowances']),
        'gross_m':       _inr(bd['gross_monthly']),
        'gross_y':       _inr(bd['net_annual']),
        'pf_employer_m': _inr(bd['employer_pf_monthly']),
        'pf_employer_y': _inr(bd['employer_pf']),
        'additions_m':   _inr(additions_m),
        'additions_y':   _inr(additions_y),
        'total_ctc_m':   _inr(total_ctc_m),
        'total_ctc_y':   _inr(bd['ctc']),
        'pf_employee_m': _inr(emp_pf_m),
        'pf_employee_y': _inr(emp_pf_m * 12),
        'prof_tax_m':    _inr(prof_tax_m),
        'prof_tax_y':    _inr(prof_tax_m * 12),
        'deductions_m':  _inr(total_ded_m),
        'deductions_y':  _inr(total_ded_y),
        'net_pay_m':     _inr(net_pay_m),
        'net_pay_y':     _inr(net_pay_y),
    })
    return ctx


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich(letter, db):
    letter['_id'] = str(letter['_id'])
    try:
        emp = db.employees.find_one({'_id': ObjectId(letter['employee_id'])})
        letter['employee_name'] = emp.get('name', 'Unknown') if emp else 'Unknown'
        letter['employee_code'] = emp.get('employee_id', '')  if emp else ''
        letter['designation']   = emp.get('designation', '')  if emp else ''
        letter['emp_email']     = emp.get('email', '')        if emp else ''
    except Exception:
        letter['employee_name'] = letter['employee_code'] = letter['designation'] = letter['emp_email'] = ''
    letter.pop('docx_path', None)
    letter.pop('pdf_path', None)
    return letter


def _caller(db, uid):
    u = db.users.find_one({'_id': ObjectId(uid)})
    return (u, None) if u else (None, (jsonify({'error': 'User not found'}), 404))


def _next_version(db, emp_id):
    latest = db.letters.find_one({'employee_id': emp_id, 'letter_type': 'offer'}, sort=[('version', -1)])
    return (latest['version'] + 1) if latest else 1


def _gen_files(emp, tmpl, ctx, db, emp_id, app):
    ver  = _next_version(db, emp_id)
    year = datetime.now().strftime('%Y')
    out  = os.path.join(app.config['STORAGE_ROOT'], 'letters', year)
    os.makedirs(out, exist_ok=True)
    base = f"{emp.get('employee_id', emp_id)}_offer_v{ver}"
    dp   = os.path.join(out, base + '.docx')
    pp   = os.path.join(out, base + '.pdf')
    generate_letter_docx(tmpl['file_path'], ctx, dp)
    pr   = generate_letter_pdf(dp, pp)
    return ver, dp, pr


# ── Routes ────────────────────────────────────────────────────────────────────
@letters_bp.route('/', methods=['GET'])
@jwt_required()
def list_letters():
    db  = current_app.db
    uid = get_jwt_identity()
    caller, _ = _caller(db, uid)
    query = {'letter_type': 'offer'}

    # Employee role sees only their own letters
    if caller and caller.get('role') == 'employee':
        query['employee_id'] = caller.get('employee_ref', '__none__')

    status = request.args.get('status')
    tab    = request.args.get('tab')
    emp_id = request.args.get('employee_id')

    if status:
        query['status'] = status
    elif tab == 'active':
        query['status'] = {'$in': list(ACTIVE_STATUSES)}
    elif tab == 'completed':
        query['status'] = {'$in': list(COMPLETED_STATUSES)}

    if emp_id and caller and caller.get('role') != 'employee':
        query['employee_id'] = emp_id

    return jsonify([_enrich(l, db) for l in db.letters.find(query).sort('created_at', -1)])

@letters_bp.route('/<lid>/preview-context', methods=['GET'])
@jwt_required()
def preview_context(lid):
    db = current_app.db
    letter = db.letters.find_one({'_id': ObjectId(lid)})
    if not letter:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'context':     letter.get('context', {}),
        'breakdown':   letter.get('breakdown', {}),
        'status':      letter.get('status'),
        'version':     letter.get('version', 1),
        'template_id': letter.get('template_id'),
    })


@letters_bp.route('/<lid>/preview-pdf', methods=['GET'])
@jwt_required()
def preview_pdf(lid):
    db = current_app.db
    letter = db.letters.find_one({'_id': ObjectId(lid)})
    if not letter:
        return jsonify({'error': 'Not found'}), 404

    pdf_path  = letter.get('pdf_path')
    docx_path = letter.get('docx_path')

    if pdf_path and os.path.exists(pdf_path):
        return send_file(pdf_path, mimetype='application/pdf')

    if docx_path and os.path.exists(docx_path):
        tmp_pdf = docx_path.replace('.docx', '_preview.pdf')
        result  = generate_letter_pdf(docx_path, tmp_pdf)
        if result and os.path.exists(result):
            return send_file(result, mimetype='application/pdf')

    return jsonify({'error': 'No document available for preview'}), 404


@letters_bp.route('/<lid>/update-draft', methods=['POST'])
@jwt_required()
def update_draft(lid):
    """
    HR edits a draft or rejected letter — updates context fields and
    regenerates the DOCX in place. Only allowed on draft or rejected status.
    """
    db   = current_app.db
    uid  = get_jwt_identity()
    data = request.json or {}

    letter = db.letters.find_one({'_id': ObjectId(lid)})
    if not letter:
        return jsonify({'error': 'Not found'}), 404
    if letter.get('status') not in ('draft', 'rejected'):
        return jsonify({'error': 'Only draft or rejected letters can be edited'}), 400

    new_fields = data.get('fields', {})
    if not new_fields:
        return jsonify({'error': 'fields required'}), 400

    ctx = {**letter.get('context', {}), **new_fields}
    ctx['date'] = ctx.get('date') or datetime.now().strftime('%d-%m-%Y')

    emp  = db.employees.find_one({'_id': ObjectId(letter['employee_id'])})
    tmpl = db.templates.find_one({'_id': ObjectId(letter['template_id'])})
    if not emp or not tmpl:
        return jsonify({'error': 'Employee or template not found'}), 404

    try:
        emp_id = str(emp['_id'])
        ver, dp, pr = _gen_files(emp, tmpl, ctx, db, emp_id, current_app)
    except Exception as e:
        return jsonify({'error': f'Regeneration failed: {e}'}), 500

    db.letters.update_one({'_id': ObjectId(lid)}, {'$set': {
        'context':    ctx,
        'docx_path':  dp,
        'pdf_path':   pr,
        'version':    ver,
        'status':     'draft',
        'updated_at': datetime.utcnow(),
    }})
    return jsonify({'message': 'Draft updated', 'version': ver})

@letters_bp.route('/ctc-breakdown', methods=['POST'])
@jwt_required()
def ctc_breakdown():
    data = request.json or {}
    try:
        ctc = float(data.get('annual_ctc', 0) or 0)
    except (ValueError, TypeError):
        return jsonify({'error': 'annual_ctc must be a number'}), 400
    if ctc <= 0:
        return jsonify({'error': 'annual_ctc must be positive'}), 400
    bd = calculate_ctc_breakdown(
        ctc,
        avail_pf   = bool(data.get('avail_pf', True)),
        ghi_annual = float(data.get('ghi_annual', 0) or 0),
        metro      = bool(data.get('metro', False)),
    )
    return jsonify(bd)

@letters_bp.route('/generate-new', methods=['POST'])
@jwt_required()
def generate_new():
    """
    Pure placeholder-fill flow.
    Receives template_id + a flat `fields` dict whose keys are the exact
    placeholder names from the template (without the {{ }}).
    Every field is user-entered — no auto-fill logic.
    The employee record is built by probing common alias names for each field.
    No specific placeholder name is required — generation never blocked by naming.
    """
    db   = current_app.db
    uid  = get_jwt_identity()
    data = request.json or {}

    tmpl_id = data.get('template_id')
    fields  = data.get('fields', {})

    if not tmpl_id:
        return jsonify({'error': 'template_id is required'}), 400
    if not fields:
        return jsonify({'error': 'fields dict is required'}), 400

    tmpl = db.templates.find_one({'_id': ObjectId(tmpl_id)})
    if not tmpl:  return jsonify({'error': 'Template not found'}), 404
    if not tmpl.get('is_active'): return jsonify({'error': 'Template is inactive'}), 400

    # Validate all template placeholders are present in the submitted fields
    # (skip date and employee_id — always auto-set)
    tmpl_placeholders = [p.lower() for p in (tmpl.get('placeholders') or [])]
    field_keys = {k.lower(): k for k in fields.keys()}

    CTC_AUTO_FIELDS = {
        'basic','hra','da','employer_pf','ghi','other_allowances',
        'gross_monthly','net_annual','ctc_fmt','basic_fmt','hra_fmt','da_fmt',
        'employer_pf_fmt','ghi_fmt','other_allowances_fmt','gross_monthly_fmt',
        'net_annual_fmt','basic_monthly','hra_monthly','da_monthly',
        'employer_pf_monthly','other_allowances_monthly',
        'basic_m','basic_y','hra_m','hra_y','da_m','da_y',
        'other_m','other_y','gross_m','gross_y',
        'pf_employer_m','pf_employer_y','additions_m','additions_y',
        'total_ctc_m','total_ctc_y','pf_employee_m','pf_employee_y',
        'prof_tax_m','prof_tax_y','deductions_m','deductions_y',
        'net_pay_m','net_pay_y',
    }

    missing = [
        p for p in tmpl_placeholders
        if p not in field_keys
        and p not in ('date', 'employee_id')
        and p not in CTC_AUTO_FIELDS
    ]

    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    # ── Build internal employee record ────────────────────────────────────────
    # Try multiple common placeholder aliases for each field.
    # Falls back to a safe default so letter generation is NEVER blocked by
    # the user's choice of placeholder names in their template.
    from routes.employees import _next_emp_id
    emp_id_code = _next_emp_id(db)

    def _pick(*keys, default=''):
        for k in keys:
            v = fields.get(k)
            if v and str(v).strip():
                return str(v).strip()
        return default

    emp_data = {
        'name':             _pick('candidate_name', 'employee_name', 'name',
                                  'full_name', 'applicant_name', default='Candidate'),
        'designation':      _pick('designation', 'post', 'position',
                                  'job_title', 'role', default=''),
        'department':       _pick('department', 'dept', 'division', default=''),
        'email':            _pick('email', 'candidate_email', 'employee_email', default=''),
        'joining_date':     _pick('joining_date', 'date_of_joining', 'doj',
                                  'start_date', default=''),
        'address':          _pick('address', 'residential_address',
                                  'permanent_address', default=''),
        'probation_period': _pick('probation_period', 'probation', default='6'),
        'notice_period':    _pick('notice_period', 'notice', default='30'),
        'employee_id':      emp_id_code,
        'status':           'active',
        'visible':          False,
        'created_at':       datetime.utcnow(),
        'created_by':       uid,
    }

    emp_res = db.employees.insert_one(emp_data)
    emp_id  = str(emp_res.inserted_id)
    emp     = db.employees.find_one({'_id': emp_res.inserted_id})

    # ── Build DOCX context ────────────────────────────────────────────────────
    # Start with every user-filled field, then inject auto-set system fields.
    ctx = {k.lower(): v for k, v in fields.items()}
    ctx['employee_id'] = emp_id_code
    ctx['date']        = fields.get('date') or datetime.now().strftime('%d-%m-%Y')

    # Auto-calculate CTC breakdown and inject all table placeholders
    try:
        raw_ctc = float(ctx.get('ctc') or 0)
        if raw_ctc > 0:
            bd  = calculate_ctc_breakdown(raw_ctc, avail_pf=True, ghi_annual=0, metro=False)
            ctx = _ctc_to_ctx(ctx, bd)
            log.info(f'CTC breakdown injected for ctc={raw_ctc}')
    except Exception as e:
        log.warning(f'CTC breakdown injection failed: {e}')

    try:
        ver, dp, pr = _gen_files(emp, tmpl, ctx, db, emp_id, current_app)
        
    except Exception as e:
        db.employees.delete_one({'_id': emp_res.inserted_id})
        return jsonify({'error': f'Document generation failed: {e}'}), 500

    result = db.letters.insert_one({
        'employee_id':    emp_id,
        'template_id':    tmpl_id,
        'letter_type':    'offer',
        'letter_subtype': 'new',
        'status':         'draft',
        'approval_history': [],
        'docx_path':  dp, 'pdf_path': pr,
        'context':    ctx, 'breakdown': {},
        'version':    ver, 'generated_by': uid,
        'candidate_email': emp_data['email'],
        'created_at': datetime.utcnow(),
    })
    return jsonify({
        'id':            str(result.inserted_id),
        'employee_id':   emp_id,
        'employee_code': emp_id_code,
        'version':       ver,
        'has_pdf':       pr is not None,
    }), 201



@letters_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate():
    db   = current_app.db
    uid  = get_jwt_identity()
    data = request.json or {}

    emp_id  = data.get('employee_id')
    tmpl_id = data.get('template_id')
    if not emp_id or not tmpl_id:
        return jsonify({'error': 'employee_id and template_id required'}), 400

    emp  = db.employees.find_one({'_id': ObjectId(emp_id)})
    tmpl = db.templates.find_one({'_id': ObjectId(tmpl_id)})
    if not emp:  return jsonify({'error': 'Employee not found'}), 404
    if not tmpl: return jsonify({'error': 'Template not found'}), 404
    if not tmpl.get('is_active'): return jsonify({'error': 'Template is inactive'}), 400

    try:
        ctc = float(data.get('annual_ctc') or emp.get('ctc', 0) or 0)
    except (ValueError, TypeError):
        ctc = 0.0

    bd  = calculate_ctc_breakdown(ctc,
            avail_pf=bool(data.get('avail_pf', True)),
            ghi_annual=float(data.get('ghi_annual', 0) or 0),
            metro=bool(data.get('metro', False)))

    ctx = {
        'employee_name': emp.get('name', ''),
        'employee_id': emp.get('employee_id', ''),
        'designation': emp.get('designation', ''),
        'department': emp.get('department', ''),
        'joining_date': data.get('joining_date') or emp.get('joining_date', ''),
        'address': emp.get('address', ''),
        'probation_period': str(emp.get('probation_period', '6')),
        'notice_period': str(emp.get('notice_period', '30')),
        'company_name': data.get('company_name', 'Acme Corp'),
        'hr_signatory_name': data.get('hr_signatory_name', ''),
        'hr_signatory_designation': data.get('hr_signatory_designation', 'HR Manager'),
        'date': datetime.now().strftime('%d-%m-%Y'),
        **data.get('extra_fields', {}),
    }
    ctx = _ctc_to_ctx(ctx, bd)

    if ctc > 0:
        db.employees.update_one({'_id': ObjectId(emp_id)}, {'$set': {'ctc': ctc}})

    try:
        ver, dp, pr = _gen_files(emp, tmpl, ctx, db, emp_id, current_app)
    except Exception as e:
        return jsonify({'error': f'Document generation failed: {e}'}), 500

    result = db.letters.insert_one({
        'employee_id': emp_id, 'template_id': tmpl_id,
        'letter_type': 'offer', 'letter_subtype': 'new',
        'status': 'draft', 'approval_history': [],
        'docx_path': dp, 'pdf_path': pr,
        'context': ctx, 'breakdown': bd,
        'version': ver, 'generated_by': uid,
        'candidate_email': data.get('candidate_email') or emp.get('email', ''),
        'created_at': datetime.utcnow(),
    })
    return jsonify({'id': str(result.inserted_id), 'version': ver,
                    'has_pdf': pr is not None, 'breakdown': bd}), 201



@letters_bp.route('/revise', methods=['POST'])
@jwt_required()
def revise():
    db   = current_app.db
    uid  = get_jwt_identity()
    data = request.json or {}

    orig_id = data.get('original_letter_id')
    if not orig_id: return jsonify({'error': 'original_letter_id required'}), 400

    orig = db.letters.find_one({'_id': ObjectId(orig_id)})
    if not orig: return jsonify({'error': 'Original letter not found'}), 404

    emp_id = orig['employee_id']
    emp    = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp: return jsonify({'error': 'Employee not found'}), 404

    tmpl_id = data.get('template_id') or orig.get('template_id')
    tmpl    = db.templates.find_one({'_id': ObjectId(tmpl_id)})
    if not tmpl: return jsonify({'error': 'Template not found'}), 404

    obd = orig.get('breakdown', {})
    try:
        ctc = float(data.get('annual_ctc') or obd.get('ctc', 0) or 0)
    except (ValueError, TypeError):
        ctc = 0.0

    bd  = calculate_ctc_breakdown(ctc,
            avail_pf=bool(data.get('avail_pf', obd.get('avail_pf', True))),
            ghi_annual=float(data.get('ghi_annual', obd.get('ghi', 0)) or 0),
            metro=bool(data.get('metro', obd.get('metro', False))))

    oc  = orig.get('context', {})
    ctx = {
        **oc,
        'joining_date': data.get('joining_date') or oc.get('joining_date', ''),
        'company_name': data.get('company_name') or oc.get('company_name', 'Acme Corp'),
        'hr_signatory_name': data.get('hr_signatory_name') or oc.get('hr_signatory_name', ''),
        'hr_signatory_designation': data.get('hr_signatory_designation') or oc.get('hr_signatory_designation', 'HR Manager'),
        'date': datetime.now().strftime('%d-%m-%Y'),
        **data.get('extra_fields', {}),
    }
    ctx = _ctc_to_ctx(ctx, bd)

    try:
        ver, dp, pr = _gen_files(emp, tmpl, ctx, db, emp_id, current_app)
    except Exception as e:
        return jsonify({'error': f'Document generation failed: {e}'}), 500

    result = db.letters.insert_one({
        'employee_id': emp_id, 'template_id': tmpl_id,
        'letter_type': 'offer', 'letter_subtype': 'revised',
        'original_letter_id': orig_id,
        'status': 'draft', 'approval_history': [],
        'docx_path': dp, 'pdf_path': pr,
        'context': ctx, 'breakdown': bd,
        'version': ver, 'generated_by': uid,
        'candidate_email': data.get('candidate_email') or orig.get('candidate_email', '') or emp.get('email', ''),
        'created_at': datetime.utcnow(),
    })
    return jsonify({'id': str(result.inserted_id), 'version': ver,
                    'has_pdf': pr is not None, 'breakdown': bd}), 201

@letters_bp.route('/<lid>', methods=['GET'])
@jwt_required()
def get_letter(lid):
    db = current_app.db
    l  = db.letters.find_one({'_id': ObjectId(lid)})
    return (jsonify(_enrich(l, db)) if l else (jsonify({'error': 'Not found'}), 404))

@letters_bp.route('/<lid>/submit', methods=['POST'])
@jwt_required()
def submit(lid):
    db  = current_app.db
    uid = get_jwt_identity()
    l   = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Letter not found'}), 404
    if l['status'] != 'draft':
        return jsonify({'error': 'Only draft letters can be submitted'}), 400
    db.letters.update_one({'_id': ObjectId(lid)}, {
        '$set':  {'status': 'pending_hr_head', 'updated_at': datetime.utcnow()},
        '$push': {'approval_history': {
            'user_id': uid, 'action': 'submitted',
            'from': 'draft', 'to': 'pending_hr_head',
            'remarks': (request.json or {}).get('remarks', ''),
            'timestamp': datetime.utcnow().isoformat(),
        }},
    })
    return jsonify({'message': 'Submitted to HR Head for approval'})


@letters_bp.route('/<lid>/hr-action', methods=['POST'])
@jwt_required()
def hr_action(lid):
    """HR Head approves or rejects. Optional inline edits regenerate the DOCX."""
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _caller(db, uid)
    if err: return err
    if caller.get('role') not in ('hr_head', 'admin'):
        return jsonify({'error': 'Only HR Head or Admin can take this action'}), 403

    l = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Letter not found'}), 404
    if l['status'] != 'pending_hr_head':
        return jsonify({'error': f"Cannot act on status '{l['status']}'"}), 400

    data    = request.json or {}
    act     = data.get('action')
    remarks = data.get('remarks', '').strip()
    edits   = data.get('edits', {})

    if act not in ('approve', 'reject'):
        return jsonify({'error': "action must be 'approve' or 'reject'"}), 400
    if act == 'reject' and not remarks:
        return jsonify({'error': 'Rejection reason is required'}), 400

    new_status = 'approved' if act == 'approve' else 'rejected'
    ops = {
        '$set':  {'status': new_status, 'updated_at': datetime.utcnow()},
        '$push': {'approval_history': {
            'user_id': uid, 'user_name': caller.get('name', ''),
            'role': caller.get('role'), 'action': act,
            'from': 'pending_hr_head', 'to': new_status,
            'remarks': remarks, 'timestamp': datetime.utcnow().isoformat(),
        }},
    }

    if edits and act == 'approve':
        new_ctx = {**l.get('context', {}), **edits, 'date': datetime.now().strftime('%d-%m-%Y')}
        tmpl = db.templates.find_one({'_id': ObjectId(l['template_id'])})
        if tmpl:
            try:
                generate_letter_docx(tmpl['file_path'], new_ctx, l['docx_path'])
                pr = generate_letter_pdf(l['docx_path'], l.get('pdf_path', l['docx_path'].replace('.docx', '.pdf')))
                ops['$set']['context'] = new_ctx
                ops['$set']['pdf_path'] = pr
                ops['$set']['edited_by_hr_head'] = True
            except Exception as e:
                log.warning(f'Inline edit doc regen failed: {e}')

    db.letters.update_one({'_id': ObjectId(lid)}, ops)
    return jsonify({'message': f'Letter {act}d', 'new_status': new_status})


@letters_bp.route('/<lid>/send-email', methods=['POST'])
@jwt_required()
def send_email(lid):
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _caller(db, uid)
    if err: return err
    if caller.get('role') not in ('hr_head', 'admin'):
        return jsonify({'error': 'Only HR Head or Admin can send offer letters'}), 403

    l = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Letter not found'}), 404
    if l['status'] != 'approved':
        return jsonify({'error': 'Only approved letters can be emailed'}), 400

    data      = request.json or {}
    to_email  = data.get('to_email') or l.get('candidate_email', '')
    if not to_email:
        return jsonify({'error': 'Recipient email is required'}), 400

    ctx       = l.get('context', {})
    emp_name  = ctx.get('candidate_name') or ctx.get('employee_name') or 'Candidate'
    company   = ctx.get('company_name', 'Infopace Management Pvt Ltd')
    desig     = ctx.get('designation', '')
    joining   = ctx.get('joining_date', '')
    ctc       = ctx.get('ctc_fmt') or ctx.get('ctc', '')
    sig_name  = ctx.get('hr_signatory_name', 'Aarpitha S')
    sig_desig = ctx.get('hr_signatory_designation', 'HR Associate')
    custom_msg = data.get('message', '').strip()


    # ── Professional email body ──────────────────────────────────────────
    body = f"""Dear {emp_name},

            Please find attached your Offer Letter from {company} for the position of {desig}.

            We kindly request you to review the document carefully and go through the terms and conditions mentioned in the letter.

            {f'Personal Note from HR:{chr(10)}{custom_msg}{chr(10)}' if custom_msg else ''}

            To confirm your acceptance, please sign and return a copy of the Offer Letter via email or submit it in person on your date of joining.

            If you have any questions or require further clarification, please feel free to reach out to us. We will be happy to assist you.

            We look forward to having you as part of the {company} team.

            Warm regards, 

            {sig_name}
            {sig_desig}
            {company}

        """

    smtp_host = os.getenv('SMTP_HOST') or os.getenv('SMTP_SERVER', '')
    smtp_user = os.getenv('SMTP_USER') or os.getenv('SMTP_EMAIL', '')
    smtp_pass = os.getenv('SMTP_PASS') or os.getenv('SMTP_PASSWORD', '')
    smtp_port = int(os.getenv('SMTP_PORT', 587))
    from_addr = os.getenv('SMTP_FROM') or os.getenv('SMTP_EMAIL', smtp_user)
    sent      = False
    err_msg   = ''

    print("SMTP DEBUG:", smtp_host, smtp_user, smtp_pass, smtp_port, from_addr)

    if not smtp_host or not smtp_user:
        return jsonify({
            'error': 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in your .env file.'
        }), 500

    try:
        msg = MIMEMultipart()
        msg['From']    = f'{company} HR <{from_addr}>'
        msg['To']      = to_email
        msg['Subject'] = f'Offer Letter — {desig} at {company}'

        msg.attach(MIMEText(body, 'plain'))

        # Attach DOCX
        if l.get('docx_path') and os.path.exists(l['docx_path']):
            with open(l['docx_path'], 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename="Offer_Letter_{emp_name.replace(" ", "_")}.docx"'
            )
            msg.attach(part)

        # Attach PDF if available
        if l.get('pdf_path') and os.path.exists(l['pdf_path']):
            with open(l['pdf_path'], 'rb') as f:
                part = MIMEBase('application', 'pdf')
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename="Offer_Letter_{emp_name.replace(" ", "_")}.pdf"'
            )
            msg.attach(part)

        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            s.login(smtp_user, smtp_pass)
            s.sendmail(from_addr, to_email, msg.as_string())

        sent = True

    except smtplib.SMTPAuthenticationError:
        err_msg = 'Gmail authentication failed. Check your App Password in .env.'
        print("SMTP AUTH ERROR:", err_msg)
    except smtplib.SMTPException as e:
        err_msg = f'SMTP error: {str(e)}'
        print("SMTP ERROR:", err_msg)
    except Exception as e:
        err_msg = f'Email failed: {str(e)}'
        print("EMAIL EXCEPTION:", err_msg)

    if not sent:
        return jsonify({'error': err_msg}), 500

    # Update letter status to issued
    db.letters.update_one({'_id': ObjectId(lid)}, {
        '$set': {
            'status': 'issued',
            'candidate_email': to_email,
            'email_sent_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow(),
        },
        '$push': {'approval_history': {
            'user_id': uid,
            'user_name': caller.get('name', ''),
            'action': 'issued',
            'from': 'approved',
            'to': 'issued',
            'remarks': f'Offer letter emailed to {to_email}',
            'timestamp': datetime.utcnow().isoformat(),
        }},
    })

    return jsonify({
        'message': f'Offer letter successfully emailed to {to_email}',
        'email_sent': True,
        'to_email': to_email,
    })


@letters_bp.route('/<lid>/confirm-join', methods=['POST'])
@jwt_required()
def confirm_join(lid):
    db  = current_app.db
    uid = get_jwt_identity()
    l   = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Letter not found'}), 404
    if l['status'] not in ('approved', 'issued'):
        return jsonify({'error': 'Can only confirm joining for approved/issued letters'}), 400
    db.letters.update_one({'_id': ObjectId(lid)}, {
        '$set':  {'status': 'joined', 'join_confirmed_at': datetime.utcnow().isoformat(), 'updated_at': datetime.utcnow()},
        '$push': {'approval_history': {
            'user_id': uid, 'action': 'join_confirmed',
            'from': l['status'], 'to': 'joined',
            'remarks': 'Candidate confirmed readiness to join',
            'timestamp': datetime.utcnow().isoformat(),
        }},
    })
    return jsonify({'message': 'Joining confirmed. Click "Create ID" to generate login credentials.'})


@letters_bp.route('/<lid>/create-id', methods=['POST'])
@jwt_required()
def create_id(lid):
    """
    HR Head creates employee login account.
    - role = 'employee', default password = 12345678
    - employee_type set to 'joining' (shown in Joining Employees tab)
    """
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _caller(db, uid)
    if err: return err
    if caller.get('role') not in ('hr_head', 'admin'):
        return jsonify({'error': 'Only HR Head or Admin can create employee IDs'}), 403

    l = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Letter not found'}), 404
    if l['status'] != 'joined':
        return jsonify({'error': 'Candidate must confirm joining first (status must be joined)'}), 400

    emp = db.employees.find_one({'_id': ObjectId(l['employee_id'])})
    if not emp: return jsonify({'error': 'Employee record not found'}), 404

    if db.users.find_one({'employee_ref': str(emp['_id'])}):
        return jsonify({'error': 'Login ID already created for this employee'}), 400

    data       = request.json or {}
    login_email = data.get('email') or l.get('candidate_email') or emp.get('email') or ''
    emp_code   = emp.get('employee_id', str(emp['_id']))
    if not login_email:
        login_email = f"{emp_code.lower()}@company.com"

    DEFAULT_PW = '12345678'
    hashed     = bcrypt.hashpw(DEFAULT_PW.encode(), bcrypt.gensalt())

    user_res = db.users.insert_one({
        'name': emp.get('name', ''), 'email': login_email,
        'password': hashed, 'role': 'employee',
        'employee_ref': str(emp['_id']), 'emp_code': emp_code,
        'created_at': datetime.utcnow(), 'created_by': uid,
    })

    db.employees.update_one({'_id': emp['_id']}, {'$set': {
        'employee_type': 'joining', 'login_created': True,
        'login_user_id': str(user_res.inserted_id),
        'login_email': login_email, 'updated_at': datetime.utcnow(),
        # Change 3: make employee visible in Employees section only after full lifecycle
        'visible': True,
    }})

    db.letters.update_one({'_id': ObjectId(lid)}, {
        '$set':  {'login_created': True, 'login_user_id': str(user_res.inserted_id), 'updated_at': datetime.utcnow()},
        '$push': {'approval_history': {
            'user_id': uid, 'user_name': caller.get('name', ''),
            'action': 'id_created', 'remarks': f'Login: {login_email}',
            'timestamp': datetime.utcnow().isoformat(),
        }},
    })

    return jsonify({
        'message': 'Employee login ID created and added to Joining Employees',
        'login_email': login_email, 'emp_code': emp_code,
        'default_password': DEFAULT_PW, 'user_id': str(user_res.inserted_id),
    }), 201


@letters_bp.route('/<lid>/download', methods=['GET'])
@jwt_required()
def download(lid):
    db  = current_app.db
    fmt = request.args.get('format', 'docx')
    l   = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Not found'}), 404
    if fmt == 'pdf' and l.get('status') not in ('approved', 'issued', 'joined'):
        return jsonify({'error': 'PDF only available for approved/issued letters'}), 403
    if fmt == 'pdf' and l.get('pdf_path') and os.path.exists(l['pdf_path']):
        return send_file(l['pdf_path'], as_attachment=True, download_name=os.path.basename(l['pdf_path']))
    if l.get('docx_path') and os.path.exists(l['docx_path']):
        return send_file(l['docx_path'], as_attachment=True, download_name=os.path.basename(l['docx_path']))
    return jsonify({'error': 'File not found on disk'}), 404


@letters_bp.route('/<lid>', methods=['DELETE'])
@jwt_required()
def delete_letter(lid):
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _caller(db, uid)
    if err: return err
    if caller.get('role') not in DELETE_ROLES:
        return jsonify({'error': 'Only Admin or HR Head can delete letters'}), 403
    l = db.letters.find_one({'_id': ObjectId(lid)})
    if not l: return jsonify({'error': 'Letter not found'}), 404
    if l.get('status') not in DELETABLE_STATUSES:
        return jsonify({'error': f"Cannot delete a '{l['status']}' letter. Only draft/rejected can be deleted."}), 400
    for pk in ('docx_path', 'pdf_path'):
        fp = l.get(pk)
        if fp and os.path.exists(fp):
            try: os.remove(fp)
            except OSError: pass
    db.letters.delete_one({'_id': ObjectId(lid)})
    return jsonify({'message': f"Deleted by {caller.get('name', uid)} at {datetime.utcnow().isoformat()}"})