from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt, os
from datetime import datetime
from bson import ObjectId

auth_bp = Blueprint('auth', __name__)

# FIX #8: dummy hash used to prevent timing attacks on login
_DUMMY_HASH = bcrypt.hashpw(b'dummy-timing-guard', bcrypt.gensalt())

def serialize_user(user):
    d = {
        'id':    str(user['_id']),
        'email': user['email'],
        'name':  user['name'],
        'role':  user['role'],
    }
    if user.get('employee_ref'):
        d['employee_ref'] = user['employee_ref']
    if user.get('emp_code'):
        d['emp_code'] = user['emp_code']
    return d

def _require_admin(db, uid):
    """Returns (caller, error_response). error_response is None if caller is admin."""
    caller = db.users.find_one({'_id': ObjectId(uid)})
    if not caller:
        return None, (jsonify({'error': 'User not found'}), 404)
    if caller.get('role') != 'admin':
        return None, (jsonify({'error': 'Admin only'}), 403)
    return caller, None


@auth_bp.route('/login', methods=['POST'])
def login():
    # FIX #8: validate body before use
    data = request.json or {}
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'email and password are required'}), 400
    db   = current_app.db
    user = db.users.find_one({'email': data['email']})
    # FIX #8: always run checkpw to prevent email enumeration via timing
    pwd_bytes = data['password'].encode()
    check_hash = user['password'] if user else _DUMMY_HASH
    if not user or not bcrypt.checkpw(pwd_bytes, check_hash):
        return jsonify({'error': 'Invalid credentials'}), 401
    # Block deactivated accounts (exited employees)
    if user.get('is_active') == False:
        return jsonify({'error': 'Account deactivated. Please contact HR.'}), 403
    # Belt-and-suspenders: check employee record directly
    if user.get('employee_ref'):
        emp = db.employees.find_one({'_id': ObjectId(user['employee_ref'])})
        if emp and emp.get('status') == 'exited':
            db.users.update_one({'_id': user['_id']}, {'$set': {'is_active': False}})
            return jsonify({'error': 'Account deactivated. Please contact HR.'}), 403
    token = create_access_token(identity=str(user['_id']))
    return jsonify({'token': token, 'user': serialize_user(user)})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    db      = current_app.db
    user_id = get_jwt_identity()
    user    = db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = serialize_user(user)
    # Merge employee record fields so frontend always has them
    if user.get('employee_ref'):
        try:
            emp = db.employees.find_one({'_id': ObjectId(user['employee_ref'])})
            if emp:
                if emp.get('joining_date'): data['joining_date']  = emp['joining_date']
                if emp.get('designation'):  data['designation']   = emp['designation']
                if emp.get('department'):   data['department']    = emp['department']
                if emp.get('employee_id'):  data['employee_code'] = emp['employee_id']
        except Exception:
            pass
    # Also merge personal profile fields saved by the user
    for field in ('phone', 'personal_email', 'gender', 'blood_group',
                  'birthday', 'address', 'emergency_contact_name',
                  'emergency_contact_phone', 'emergency_contact_relation'):
        if user.get(field):
            data[field] = user[field]
    return jsonify(data)


@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    db     = current_app.db
    uid    = get_jwt_identity()
    caller = db.users.find_one({'_id': ObjectId(uid)})
    if not caller or caller.get('role') not in ('admin', 'hr_head'):
        return jsonify({'error': 'Access denied'}), 403
    role  = request.args.get('role')
    query = {'role': role} if role else {}
    users = list(db.users.find(query, {'password': 0}))
    for u in users:
        u['_id'] = str(u['_id'])
    return jsonify(users)


@auth_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    # FIX #7: admin only
    db  = current_app.db
    uid = get_jwt_identity()
    _, err = _require_admin(db, uid)
    if err: return err
    data = request.json or {}
    if not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'name, email and password are required'}), 400
    if db.users.find_one({'email': data['email']}):
        return jsonify({'error': 'Email already exists'}), 400
    hashed = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt())
    user = {
        'name':       data['name'],
        'email':      data['email'],
        'password':   hashed,
        'role':       data.get('role', 'hr'),
        'created_at': datetime.utcnow(),
    }
    result = db.users.insert_one(user)
    return jsonify({'id': str(result.inserted_id), 'message': 'User created'}), 201


@auth_bp.route('/seed', methods=['POST'])
def seed():
    # FIX #9: block in production
    if os.getenv('FLASK_ENV') == 'production':
        return jsonify({'error': 'Seed disabled in production'}), 403
    db = current_app.db
    if db.users.find_one({'email': 'admin@company.com'}):
        return jsonify({'message': 'Already seeded'})
    users = [
        {'name': 'Admin User',   'email': 'admin@company.com',   'password': bcrypt.hashpw(b'admin123',   bcrypt.gensalt()), 'role': 'admin',   'created_at': datetime.utcnow()},
        {'name': 'HR Executive', 'email': 'hr@company.com',       'password': bcrypt.hashpw(b'hr123',      bcrypt.gensalt()), 'role': 'hr',      'created_at': datetime.utcnow()},
        {'name': 'HR Manager',   'email': 'hrhead@company.com',   'password': bcrypt.hashpw(b'hrhead123',  bcrypt.gensalt()), 'role': 'hr_head', 'created_at': datetime.utcnow()},
        {'name': 'Dept Manager', 'email': 'manager@company.com',  'password': bcrypt.hashpw(b'manager123', bcrypt.gensalt()), 'role': 'manager', 'created_at': datetime.utcnow()},
    ]
    db.users.insert_many(users)
    return jsonify({'message': 'Seeded successfully'})

@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    db   = current_app.db
    uid  = get_jwt_identity()
    data = request.json or {}

    current_password = data.get('current_password', '')
    new_password     = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': 'current_password and new_password are required'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    user = db.users.find_one({'_id': ObjectId(uid)})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not bcrypt.checkpw(current_password.encode(), user['password']):
        return jsonify({'error': 'Current password is incorrect'}), 400

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt())
    db.users.update_one({'_id': ObjectId(uid)}, {'$set': {'password': new_hash, 'updated_at': datetime.utcnow()}})

    return jsonify({'message': 'Password changed successfully'})


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    db  = current_app.db
    uid = get_jwt_identity()
    user = db.users.find_one({'_id': ObjectId(uid)}, {'password': 0})
    if not user:
        return jsonify({'error': 'Not found'}), 404
    user['_id'] = str(user['_id'])
    # Also pull employee record if linked
    if user.get('employee_ref'):
        emp = db.employees.find_one({'_id': ObjectId(user['employee_ref'])})
        if emp:
            # Only set if value actually exists — skip empty strings
            if emp.get('joining_date'): user['joining_date']  = emp['joining_date']
            if emp.get('designation'):  user['designation']   = emp['designation']
            if emp.get('department'):   user['department']    = emp['department']
            if emp.get('employee_id'):  user['employee_code'] = emp['employee_id']
    return jsonify(user)


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    db   = current_app.db
    uid  = get_jwt_identity()
    data = request.json or {}

    allowed = {
        'name', 'phone', 'personal_email', 'address',
        'birthday', 'anniversary', 'emergency_contact_name',
        'emergency_contact_phone', 'emergency_contact_relation',
        'blood_group', 'gender',
    }
    update = { k: v for k, v in data.items() if k in allowed }
    update['updated_at'] = datetime.utcnow()

    db.users.update_one({'_id': ObjectId(uid)}, {'$set': update})

    # Also update name in employee record if linked
    if 'name' in update and data.get('employee_ref'):
        db.employees.update_one(
            {'_id': ObjectId(data['employee_ref'])},
            {'$set': {'name': update['name']}}
        )

    user = db.users.find_one({'_id': ObjectId(uid)}, {'password': 0})
    if not user:
        return jsonify({'error': 'User not found after update'}), 404
    user['_id'] = str(user['_id'])
    # Merge employee record so frontend user object stays complete
    if user.get('employee_ref'):
        try:
            emp = db.employees.find_one({'_id': ObjectId(user['employee_ref'])})
            if emp:
                user['joining_date']  = emp.get('joining_date',  '')
                user['designation']   = emp.get('designation',   '')
                user['department']    = emp.get('department',    '')
                user['employee_code'] = emp.get('employee_id',   '')
        except Exception:
            pass
    return jsonify({'message': 'Profile updated', 'user': user})
