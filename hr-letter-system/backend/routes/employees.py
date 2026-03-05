from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from bson import ObjectId
import csv, io

employees_bp = Blueprint('employees', __name__)

# Roles allowed to delete employee records
DELETE_ROLES = {'admin', 'hr_head'}

def serialize(emp):
    emp['_id'] = str(emp['_id'])
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
    uid    = get_jwt_identity()
    caller = db.users.find_one({'_id': ObjectId(uid)})
    role   = caller.get('role', '') if caller else ''

    status = request.args.get('status')
    query  = {}
    if status:
        query['status'] = status

    # Hide pending/incomplete employees from the Employees section.
    # An employee created via the "Create New Offer Letter" flow starts with
    # visible=False and only becomes visible after Create ID is completed.
    # hr_head and admin can always see all employees (e.g. for the Revised flow).
    if role not in ('hr_head', 'admin'):
        query['visible'] = {'$ne': False}
    else:
        # hr_head/admin: only hide if explicitly requested to show all
        show_all = request.args.get('show_all', 'false').lower() == 'true'
        if not show_all:
            query['visible'] = {'$ne': False}

    employees = list(db.employees.find(query).sort('created_at', -1))
    return jsonify([serialize(e) for e in employees])


@employees_bp.route('/<emp_id>', methods=['GET'])
@jwt_required()
def get_employee(emp_id):
    db  = current_app.db
    emp = db.employees.find_one({'_id': ObjectId(emp_id)})
    if not emp:
        return jsonify({'error': 'Not found'}), 404
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
    db   = current_app.db
    data = request.json or {}
    data.pop('_id', None)
    data['updated_at'] = datetime.utcnow()
    db.employees.update_one({'_id': ObjectId(emp_id)}, {'$set': data})
    return jsonify({'message': 'Updated'})


@employees_bp.route('/<emp_id>', methods=['DELETE'])
@jwt_required()
def delete_employee(emp_id):
    """
    Delete an employee record.
    Rules (aligned with the workflow document):
      - Only admin and hr_head roles may delete.
      - Active employees: can only be deleted if they have NO letters at all.
        (Prevents deleting someone mid-approval process.)
      - Exited employees: can always be deleted by admin/hr_head since the
        exit process is complete. Their letters remain in the DB independently.
      - Employees in notice_period / clearance stages: BLOCKED — they are
        mid-process and must complete the exit workflow first.
    """
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

    # Block mid-exit employees — they must complete the exit workflow
    if status in ('notice_period', 'clearance_pending', 'clearance_complete'):
        return jsonify({
            'error': (
                f"Cannot delete employee with status '{status}'. "
                "This employee is mid-exit-process. Complete or cancel the exit workflow first."
            )
        }), 400

    # Active employees: block if they have any letters (any status)
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
        notice_days = int(emp.get('notice_period', 30))
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

    VALID_KEYS = {'it_assets', 'finance', 'admin', 'hr_docs', 'access_cards'}
    updates    = {k: bool(v) for k, v in data.items() if k in VALID_KEYS}
    if not updates:
        return jsonify({'error': 'No valid clearance keys provided'}), 400

    current    = emp.get('clearances', {})
    merged     = {**current, **updates}
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