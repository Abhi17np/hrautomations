from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from bson import ObjectId
import csv, io

employees_bp = Blueprint('employees', __name__)

DELETE_ROLES = {'admin', 'hr_head'}

def serialize(emp):
    emp['_id'] = str(emp['_id'])
 
    # Flatten step1_data fields to root level so the HR edit form is pre-filled
    # with whatever the employee entered in their onboarding Step-1 form.
    step1 = emp.get('step1_data') or {}
 
    if not emp.get('father_name'):
        # employee Step-1 form uses 'guardian_name' for Father's/Husband's name
        emp['father_name'] = step1.get('guardian_name') or step1.get('father_name') or ''
 
    if not emp.get('work_location'):
        emp['work_location'] = step1.get('work_location') or step1.get('place') or ''
 
    if not emp.get('address'):
        emp['address'] = (step1.get('address')
                          or step1.get('postal_address')
                          or step1.get('permanent_address') or '')
 
    if not emp.get('date_of_birth'):
        emp['date_of_birth'] = step1.get('dob') or step1.get('date_of_birth') or ''
 
    if not emp.get('phone'):
        emp['phone'] = step1.get('phone') or ''
 
    return emp
 
def _next_emp_id(db):
    counter = db.counters.find_one_and_update(
        {'_id': 'employee'},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=True,
    )
    return f"EMP{str(counter['seq']).zfill(3)}"


def _get_caller(db, uid):
    user = db.users.find_one({'_id': ObjectId(uid)})
    if not user:
        return None, (jsonify({'error': 'User not found'}), 404)
    return user, None


@employees_bp.route('/', methods=['GET'])
@jwt_required()
def list_employees():
    db     = current_app.db
    status = request.args.get('status')
    query  = {}
    if status:
        query['status'] = status
    
    all_emps = list(db.employees.find(query).sort('created_at', -1))
    
    # Only show employees whose offer letter has reached id_created or beyond
    VISIBLE_LETTER_STATUSES = {'id_created', 'joined'}
    
    visible = []
    for emp in all_emps:
        emp_id = str(emp['_id'])
        # Non-active statuses (exiting, exited, inactive) always show
        if emp.get('status') != 'active':
            visible.append(serialize(emp))
            continue
        # Active: only show if they have a letter at id_created or joined
        letter = db.letters.find_one({
            'employee_id': emp_id,
            'status': {'$in': list(VISIBLE_LETTER_STATUSES)}
        })
        if letter:
            visible.append(serialize(emp))
    
    return jsonify(visible)


@employees_bp.route('/me/step1', methods=['POST'])
@jwt_required()
def save_step1():
    """
    Employee submits Step 1 personal info form.
    Saves full form under step1_data on the employee record,
    and syncs key fields to root level for the employee card.
    """
    db  = current_app.db
    uid = get_jwt_identity()

    user = db.users.find_one({'_id': ObjectId(uid)})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    emp_ref = user.get('employee_ref')
    if not emp_ref:
        return jsonify({'error': 'No employee record linked to this account'}), 400

    data = request.json or {}
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    data.pop('_id', None)

    db.employees.update_one(
        {'_id': ObjectId(emp_ref)},
        {'$set': {
            'step1_data':    data,
            # ── fields synced to root so HR edit form is always pre-filled ──
            'phone':         data.get('phone', ''),
            'date_of_birth': data.get('dob', '') or data.get('date_of_birth', ''),
            'address':       (data.get('address', '')
                              or data.get('postal_address', '')
                              or data.get('permanent_address', '')),
            # guardian_name is the key used in the employee Step-1 form
            'father_name':   data.get('guardian_name', '') or data.get('father_name', ''),
            'work_location': data.get('work_location', '') or data.get('place', ''),
            'pan_number':    data.get('pan_number', ''),
            'bank_account':  data.get('account_number', ''),
            'bank_ifsc':     data.get('ifsc_code', ''),
            'updated_at':    datetime.utcnow(),
        }}
    )
    return jsonify({'message': 'Personal information saved successfully.'}), 200



@employees_bp.route('/bulk-upload', methods=['POST'])
@jwt_required()
def bulk_upload():
    db   = current_app.db
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided'}), 400
    content = file.stream.read().decode('utf-8-sig', errors='replace')
    stream  = io.StringIO(content)
    reader  = csv.DictReader(stream)
    employees = []
    for row in reader:
        row['employee_id'] = row.get('employee_id') or _next_emp_id(db)
        row['created_at']  = datetime.utcnow()
        row['status']      = row.get('status', 'active')
        employees.append(row)
    if employees:
        db.employees.insert_many(employees)
    return jsonify({'message': f'{len(employees)} employees imported'})


@employees_bp.route('/<emp_id>', methods=['GET'])
@jwt_required()
def get_employee(emp_id):
    db  = current_app.db
    emp = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Not found'}), 404

    # Pull missing fields from latest offer letter context
    letter = db.letters.find_one(
        {'employee_id': emp_id, 'letter_type': 'offer'},
        sort=[('version', -1)]
    )
    if letter:
        ctx = letter.get('context') or {}
        if not emp.get('email'):        emp['email']       = ctx.get('email', '')
        if not emp.get('ctc'):          emp['ctc']         = ctx.get('ctc', '')
        if not emp.get('joining_date'): emp['joining_date'] = ctx.get('joining_date', '')
        if not emp.get('department'):   emp['department']   = ctx.get('department', '')

    # Final fallback: pull login email from linked user account
    if not emp.get('email'):
        linked_user = db.users.find_one({'employee_ref': emp_id})
        if linked_user:
            emp['email'] = linked_user.get('email', '')

    return jsonify(serialize(emp))


@employees_bp.route('/', methods=['POST'])
@jwt_required()
def create_employee():
    db   = current_app.db
    data = request.json or {}
    if not data.get('name') or not data.get('designation'):
        return jsonify({'error': 'name and designation are required'}), 400
    if not data.get('employee_id'):
        data['employee_id'] = _next_emp_id(db)
    data['created_at'] = datetime.utcnow()
    data['status']     = data.get('status', 'active')
    result = db.employees.insert_one(data)
    return jsonify({'id': str(result.inserted_id), 'employee_id': data['employee_id']}), 201


@employees_bp.route('/<emp_id>', methods=['PUT'])
@jwt_required()
def update_employee(emp_id):
    db  = current_app.db
    uid = get_jwt_identity()

    caller, err = _get_caller(db, uid)
    if err: return err
    if caller.get('role') != 'admin':
        return jsonify({'error': 'Only Admin can edit employee records'}), 403

    data = request.json or {}
    data.pop('_id', None)
    data['updated_at'] = datetime.utcnow()
    db.employees.update_one({'_id': ObjectId(emp_id)}, {'$set': data})
    return jsonify({'message': 'Updated'})


@employees_bp.route('/<emp_id>', methods=['DELETE'])
@jwt_required()
def delete_employee(emp_id):
    db  = current_app.db
    uid = get_jwt_identity()

    caller, err = _get_caller(db, uid)
    if err: return err

    if caller.get('role') not in DELETE_ROLES:
        return jsonify({'error': 'Only Admin or HR Head can delete employee records'}), 403

    emp = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    status = emp.get('status', 'active')

    if status in ('notice_period', 'clearance_pending', 'clearance_complete'):
        return jsonify({
            'error': (
                f"Cannot delete employee with status '{status}'. "
                "This employee is mid-exit-process. Complete or cancel the exit workflow first."
            )
        }), 400

    if status == 'active':
        linked_letters = db.letters.count_documents({'employee_id': emp_id})
        if linked_letters > 0:
            return jsonify({
                'error': (
                    f"Cannot delete: {linked_letters} offer letter(s) exist for this employee. "
                    "Delete or archive the letters first, or mark the employee as exited."
                )
            }), 400

    db.employees.delete_one({'_id': ObjectId(emp_id)})
    return jsonify({
        'message': f"Employee '{emp.get('name')}' deleted by {caller.get('name', uid)} ({caller.get('role')}) at {datetime.utcnow().isoformat()}"
    })


@employees_bp.route('/<emp_id>/deactivate', methods=['POST'])
@jwt_required()
def deactivate_employee(emp_id):
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _get_caller(db, uid)
    if err: return err

    if caller.get('role') not in ('admin', 'hr_head'):
        return jsonify({'error': 'Only Admin or HR Head can deactivate employees'}), 403

    emp = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    if emp.get('status') != 'exited':
        return jsonify({'error': 'Only exited employees can be deactivated'}), 400

    letter = db.letters.find_one({'employee_id': emp_id, 'letter_type': 'relieving'})
    if not letter:
        return jsonify({'error': 'Relieving letter must be issued before deactivating the account'}), 400

    db.employees.update_one(
        {'_id': ObjectId(emp_id)},
        {'$set': {
            'status':         'inactive',
            'deactivated_by': uid,
            'deactivated_at': datetime.utcnow().isoformat(),
            'updated_at':     datetime.utcnow(),
        }}
    )
    db.users.update_one(
        {'employee_ref': emp_id},
        {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
    )
    return jsonify({'message': 'Employee deactivated. Login access revoked.'})

@employees_bp.route('/<emp_id>/activate', methods=['POST'])
@jwt_required()
def activate_employee(emp_id):
    db  = current_app.db
    uid = get_jwt_identity()

    caller, err = _get_caller(db, uid)
    if err: return err

    if caller.get('role') not in ('admin', 'hr_head'):
        return jsonify({'error': 'Only Admin or HR Head can activate employees'}), 403

    emp = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    if emp.get('status') != 'inactive':
        return jsonify({'error': 'Only inactive employees can be activated'}), 400

    db.employees.update_one(
        {'_id': ObjectId(emp_id)},
        {'$set': {
            'status':       'active',
            'activated_by': uid,
            'activated_at': datetime.utcnow().isoformat(),
            'updated_at':   datetime.utcnow(),
        }}
    )
    db.users.update_one(
        {'employee_ref': emp_id},
        {'$set': {'is_active': True, 'updated_at': datetime.utcnow()}}
    )
    return jsonify({'message': 'Employee account activated. Login access restored.'})


# ── Exit workflow routes ──────────────────────────────────────────────────────

@employees_bp.route('/<emp_id>/exit', methods=['POST'])
@jwt_required()
def record_exit(emp_id):
    db   = current_app.db
    data = request.json or {}
    emp  = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404
    if emp.get('status') not in ('active',):
        return jsonify({'error': f"Cannot record resignation: employee status is '{emp.get('status')}'"}), 400

    resignation_date = data.get('resignation_date')
    if not resignation_date:
        return jsonify({'error': 'resignation_date is required'}), 400

    lwd = data.get('last_working_day')
    if not lwd:
        notice_days = int(emp.get('notice_period', 60))
        lwd = (datetime.strptime(resignation_date, '%Y-%m-%d') + timedelta(days=notice_days)).strftime('%Y-%m-%d')

    db.employees.update_one(
        {'_id': ObjectId(emp_id)},
        {'$set': {
            'status':           'notice_period',
            'resignation_date': resignation_date,
            'last_working_day': lwd,
            'exit_reason':      data.get('exit_reason', ''),
            'clearances': {
                'it_assets': False, 'finance': False, 'admin': False,
                'hr_docs': False, 'access_cards': False,
            },
            'updated_at': datetime.utcnow(),
        }}
    )
    return jsonify({'message': 'Resignation recorded', 'last_working_day': lwd}), 200


@employees_bp.route('/<emp_id>/clearance', methods=['POST'])
@jwt_required()
def update_clearance(emp_id):
    db   = current_app.db
    data = request.json or {}
    emp  = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    VALID_KEYS  = {'it_assets', 'finance', 'admin', 'hr_docs', 'access_cards'}
    updates     = {k: bool(v) for k, v in data.items() if k in VALID_KEYS}
    if not updates:
        return jsonify({'error': 'No valid clearance keys provided'}), 400

    current     = emp.get('clearances', {})
    merged      = {**current, **updates}
    all_cleared = all(merged.get(k, False) for k in VALID_KEYS)
    new_status  = 'clearance_complete' if all_cleared else 'clearance_pending'

    db.employees.update_one(
        {'_id': ObjectId(emp_id)},
        {'$set': {
            'clearances': merged,
            'status':     new_status,
            'updated_at': datetime.utcnow(),
        }}
    )
    return jsonify({'message': 'Clearance updated', 'all_cleared': all_cleared, 'status': new_status})