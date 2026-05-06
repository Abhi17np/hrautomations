from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId

approvals_bp = Blueprint('approvals', __name__)

# Offer letter approval now goes HR → HR Head only (no manager stage).
# The letters.py submit endpoint sets status = 'pending_hr_head' directly.
# The hr-action endpoint in letters.py handles approve/reject for hr_head.
# This FLOW dict is kept for the stats/history endpoints only.
FLOW = {
    'pending_hr_head': {
        'approve': 'approved',
        'reject':  'rejected',
        'roles':   ['hr_head', 'admin', 'hr'],
        'label':   'HR Head Review',
    },
}

def enrich_letter(letter, db):
    letter['_id'] = str(letter['_id'])
    try:
        emp = db.employees.find_one({'_id': ObjectId(letter['employee_id'])})
        letter['employee_name'] = emp['name'] if emp else 'Unknown'
        letter['employee_code'] = emp.get('employee_id', '') if emp else ''
        letter['designation']   = emp.get('designation', '') if emp else ''
    except Exception:
        letter['employee_name'] = 'Unknown'
        letter['employee_code'] = ''
        letter['designation']   = ''
    # FIX #14: never send server filesystem path to frontend
    letter.pop('docx_path', None)
    letter.pop('pdf_path', None)
    return letter


def _get_user(db, uid):
    """Returns (user, error_tuple). Centralised null-check for all routes."""
    user = db.users.find_one({'_id': ObjectId(uid)})
    if not user:
        return None, (jsonify({'error': 'User not found'}), 404)
    return user, None


@approvals_bp.route('/pending', methods=['GET'])
@jwt_required()
def pending():
    db      = current_app.db
    user_id = get_jwt_identity()
    # FIX #11: null-check user
    user, err = _get_user(db, user_id)
    if err: return err
    role       = user.get('role', 'hr')
    actionable = [s for s, cfg in FLOW.items() if role in cfg['roles']]
    letters    = list(db.letters.find(
        {'status': {'$in': actionable}, 'letter_type': 'offer'}
    ).sort('created_at', -1))
    return jsonify([enrich_letter(l, db) for l in letters])


@approvals_bp.route('/history', methods=['GET'])
@jwt_required()
def history():
    db = current_app.db
    # FIX #25: include issued and withdrawn in history
    letters = list(db.letters.find(
        {'status': {'$in': ['approved', 'rejected', 'issued', 'withdrawn']},
         'letter_type': 'offer'},
        sort=[('updated_at', -1)],
        limit=50,
    ))
    return jsonify([enrich_letter(l, db) for l in letters])


@approvals_bp.route('/<letter_id>/action', methods=['POST'])
@jwt_required()
def action(letter_id):
    db      = current_app.db
    user_id = get_jwt_identity()
    # FIX #11: null-check user
    user, err = _get_user(db, user_id)
    if err: return err
    role = user.get('role', 'hr')

    data    = request.json or {}
    act     = data.get('action')
    remarks = data.get('remarks', '').strip()

    # FIX #10: enforce remarks on rejection
    if act == 'reject' and not remarks:
        return jsonify({'error': 'Rejection reason is required'}), 400

    letter = db.letters.find_one({'_id': ObjectId(letter_id)})
    if not letter:
        return jsonify({'error': 'Letter not found'}), 404

    flow = FLOW.get(letter['status'])
    if not flow:
        return jsonify({'error': f"Letter not pending approval (status: {letter['status']})"}), 400
    if role not in flow['roles']:
        return jsonify({'error': 'Not authorized at this stage'}), 403
    if act not in ('approve', 'reject'):
        return jsonify({'error': 'action must be approve or reject'}), 400

    new_status = flow[act]
    entry = {
        'user_id':   user_id,
        'user_name': user.get('name', ''),
        'role':      role,
        'action':    act,
        'from':      letter['status'],
        'to':        new_status,
        'remarks':   remarks,
        'timestamp': datetime.utcnow().isoformat(),
    }
    db.letters.update_one(
        {'_id': ObjectId(letter_id)},
        {'$set':  {'status': new_status, 'updated_at': datetime.utcnow()},
         '$push': {'approval_history': entry}}
    )
    return jsonify({'message': f'Letter {act}d', 'new_status': new_status})


@approvals_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats():
    db = current_app.db
    # FIX #26: filter to offer letters only so relieving letters don't pollute counts
    pipeline = [
        {'$match': {'letter_type': 'offer'}},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
    ]
    results = list(db.letters.aggregate(pipeline))
    return jsonify({r['_id']: r['count'] for r in results})