"""
documents.py — Employee document upload + HR approval workflow
Files stored in MongoDB GridFS (no disk dependency).
"""

import uuid
import logging
from io import BytesIO
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
from werkzeug.utils import secure_filename
import gridfs

documents_bp = Blueprint('documents', __name__)
logger = logging.getLogger(__name__)

ALLOWED = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'doc', 'docx'}
REQUIRED_DOCS = {'photo', 'aadhaar', 'pan', 'resume', 'degree', 'degree_12', 'bank_passbook'}


def allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED


def _get_fs():
    return gridfs.GridFS(current_app.db, collection='documents_fs')


def _get_submission(db, uid):
    return db.doc_submissions.find_one({'user_id': uid}, sort=[('submitted_at', -1)])


def _is_locked(db, uid):
    sub = _get_submission(db, uid)
    return sub is not None and sub.get('status') == 'approved'


def _submission_status(db, uid):
    sub = _get_submission(db, uid)
    return sub.get('status') if sub else None


# ── Upload ──────────────────────────────────────────────────────────────────

@documents_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload():
    db  = current_app.db
    uid = get_jwt_identity()
    fs  = _get_fs()

    doc_type     = request.form.get('doc_type', 'other')
    OPTIONAL_DOCS = {'graduation', 'postgrad', 'experience', 'offer_letter'}

    if _is_locked(db, uid) and doc_type not in OPTIONAL_DOCS:
        return jsonify({'error': 'Your documents have been approved. No changes allowed.'}), 403

    if _submission_status(db, uid) == 'pending_hr':
        return jsonify({'error': 'Your documents are under HR review. Wait for the result before making changes.'}), 403

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename or not allowed(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    ext      = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uid}_{doc_type}_{uuid.uuid4().hex[:8]}.{ext}"

    # Delete old GridFS file for this doc_type if exists
    old = db.documents.find_one({'user_id': uid, 'doc_type': doc_type})
    if old and old.get('gridfs_id'):
        try:
            fs.delete(ObjectId(old['gridfs_id']))
        except Exception:
            pass

    # Save to GridFS
    file_data = file.read()
    gridfs_id = fs.put(
        file_data,
        filename=filename,
        user_id=uid,
        doc_type=doc_type,
        content_type=file.content_type or 'application/octet-stream',
        uploaded_at=datetime.utcnow(),
    )

    rel_path = f"/api/documents/file/{uid}/{filename}"

    db.documents.update_one(
        {'user_id': uid, 'doc_type': doc_type},
        {'$set': {
            'user_id':     uid,
            'doc_type':    doc_type,
            'filename':    secure_filename(file.filename),
            'gridfs_id':   str(gridfs_id),
            'url':         rel_path,
            'uploaded_at': datetime.utcnow(),
            'status':      'uploaded',
        }},
        upsert=True
    )

    return jsonify({
        'doc_type': doc_type,
        'filename': secure_filename(file.filename),
        'url':      rel_path,
        'status':   'uploaded',
    }), 201


# ── My Docs ─────────────────────────────────────────────────────────────────

@documents_bp.route('/my', methods=['GET'])
@jwt_required()
def my_docs():
    db  = current_app.db
    uid = get_jwt_identity()

    docs = list(db.documents.find({'user_id': uid}))
    for d in docs:
        d['_id'] = str(d['_id'])

    sub = _get_submission(db, uid)
    if sub:
        sub['_id'] = str(sub['_id'])

    return jsonify({'docs': docs, 'submission': sub}), 200


# ── Serve file from GridFS ───────────────────────────────────────────────────

@documents_bp.route('/file/<uid>/<filename>', methods=['GET'])
@jwt_required()
def serve_file(uid, filename):
    caller_uid = get_jwt_identity()
    db  = current_app.db
    fs  = _get_fs()

    caller = db.users.find_one({'_id': ObjectId(caller_uid)})
    if caller and caller.get('role') not in ('hr_head', 'admin', 'hr') and caller_uid != uid:
        return jsonify({'error': 'Access denied'}), 403

    doc = db.documents.find_one({'user_id': uid, 'url': f'/api/documents/file/{uid}/{filename}'})
    if not doc or not doc.get('gridfs_id'):
        return jsonify({'error': 'File not found'}), 404

    try:
        grid_out = fs.get(ObjectId(doc['gridfs_id']))
        return send_file(
            BytesIO(grid_out.read()),
            download_name=filename,
            mimetype=grid_out.content_type or 'application/octet-stream',
        )
    except Exception as e:
        logger.error('GridFS read error: %s', e)
        return jsonify({'error': 'File not found'}), 404


# ── Delete single doc ────────────────────────────────────────────────────────

@documents_bp.route('/<doc_type>', methods=['DELETE'])
@jwt_required()
def delete_doc(doc_type):
    db  = current_app.db
    uid = get_jwt_identity()
    fs  = _get_fs()

    if _is_locked(db, uid):
        return jsonify({'error': 'Your documents have been approved. No changes allowed.'}), 403

    if _submission_status(db, uid) == 'pending_hr':
        return jsonify({'error': 'Documents are under HR review. Cannot delete now.'}), 403

    doc = db.documents.find_one({'user_id': uid, 'doc_type': doc_type})
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    if doc.get('gridfs_id'):
        try:
            fs.delete(ObjectId(doc['gridfs_id']))
        except Exception:
            pass

    db.documents.delete_one({'user_id': uid, 'doc_type': doc_type})
    return jsonify({'message': f'{doc_type} deleted'}), 200


# ── Submit for HR review ─────────────────────────────────────────────────────

@documents_bp.route('/submit', methods=['POST'])
@jwt_required()
def submit_for_review():
    db  = current_app.db
    uid = get_jwt_identity()

    if _submission_status(db, uid) == 'pending_hr':
        return jsonify({'error': 'Already submitted and pending HR review.'}), 400

    uploaded_types = {d['doc_type'] for d in db.documents.find({'user_id': uid})}
    missing = REQUIRED_DOCS - uploaded_types
    if missing:
        return jsonify({'error': 'Missing required documents', 'missing': list(missing)}), 400

    docs_snapshot = list(db.documents.find({'user_id': uid}))
    for d in docs_snapshot:
        d['_id'] = str(d['_id'])

    user    = db.users.find_one({'_id': ObjectId(uid)})
    emp_ref = user.get('employee_ref') if user else None
    emp     = db.employees.find_one({'_id': ObjectId(emp_ref)}) if emp_ref else None
    step1_data = (emp.get('step1_data') or {}) if emp else {}

    sub_doc = {
        'user_id':       uid,
        'employee_id':   emp_ref,
        'employee_name': emp.get('name', user.get('name', 'Unknown')) if emp else user.get('name', 'Unknown') if user else 'Unknown',
        'employee_code': emp.get('employee_id', '') if emp else '',
        'status':        'pending_hr',
        'docs':          docs_snapshot,
        'step1_data':    step1_data,
        'submitted_at':  datetime.utcnow(),
        'updated_at':    datetime.utcnow(),
        'history': [{'action': 'submitted', 'by': uid, 'timestamp': datetime.utcnow().isoformat()}],
    }

    db.doc_submissions.update_one({'user_id': uid}, {'$set': sub_doc}, upsert=True)
    return jsonify({'message': 'Documents submitted for HR review.'}), 200


# ── HR: list submissions ─────────────────────────────────────────────────────

@documents_bp.route('/submissions', methods=['GET'])
@jwt_required()
def list_submissions():
    db  = current_app.db
    uid = get_jwt_identity()
    caller = db.users.find_one({'_id': ObjectId(uid)})
    if not caller or caller.get('role') not in ('hr_head', 'admin', 'hr'):
        return jsonify({'error': 'Access denied'}), 403

    query = {}
    status_filter = request.args.get('status')
    if status_filter:
        query['status'] = status_filter

    subs = list(db.doc_submissions.find(query).sort('submitted_at', -1))
    for s in subs:
        s['_id'] = str(s['_id'])
    return jsonify(subs), 200


# ── HR: single submission ────────────────────────────────────────────────────

@documents_bp.route('/submissions/<sub_id>', methods=['GET'])
@jwt_required()
def get_submission(sub_id):
    db  = current_app.db
    uid = get_jwt_identity()
    caller = db.users.find_one({'_id': ObjectId(uid)})
    if not caller or caller.get('role') not in ('hr_head', 'admin', 'hr'):
        return jsonify({'error': 'Access denied'}), 403

    sub = db.doc_submissions.find_one({'_id': ObjectId(sub_id)})
    if not sub:
        return jsonify({'error': 'Submission not found'}), 404

    live_docs = list(db.documents.find({'user_id': sub['user_id']}))
    for d in live_docs:
        d['_id'] = str(d['_id'])

    if not sub.get('step1_data'):
        emp_ref = sub.get('employee_id')
        if emp_ref:
            try:
                emp = db.employees.find_one({'_id': ObjectId(emp_ref)})
                if emp and emp.get('step1_data'):
                    sub['step1_data'] = emp['step1_data']
                    db.doc_submissions.update_one(
                        {'_id': ObjectId(sub_id)},
                        {'$set': {'step1_data': emp['step1_data']}}
                    )
            except Exception:
                pass

    sub['_id']  = str(sub['_id'])
    sub['docs'] = live_docs
    return jsonify(sub), 200


# ── HR: approve or reject ────────────────────────────────────────────────────

@documents_bp.route('/submissions/<sub_id>/action', methods=['POST'])
@jwt_required()
def submission_action(sub_id):
    db  = current_app.db
    uid = get_jwt_identity()
    caller = db.users.find_one({'_id': ObjectId(uid)})
    if not caller or caller.get('role') not in ('hr_head', 'admin', 'hr'):
        return jsonify({'error': 'Access denied'}), 403

    data    = request.json or {}
    action  = data.get('action')
    remarks = data.get('remarks', '').strip()

    if action not in ('approve', 'reject'):
        return jsonify({'error': "action must be 'approve' or 'reject'"}), 400
    if action == 'reject' and not remarks:
        return jsonify({'error': 'Rejection remarks are required'}), 400

    sub = db.doc_submissions.find_one({'_id': ObjectId(sub_id)})
    if not sub:
        return jsonify({'error': 'Submission not found'}), 404
    if sub.get('status') != 'pending_hr':
        return jsonify({'error': f"Submission is already '{sub.get('status')}'"}), 400

    new_status = 'approved' if action == 'approve' else 'rejected'

    db.doc_submissions.update_one(
        {'_id': ObjectId(sub_id)},
        {
            '$set': {
                'status':      new_status,
                'remarks':     remarks,
                'reviewed_by': uid,
                'reviewed_at': datetime.utcnow(),
                'updated_at':  datetime.utcnow(),
            },
            '$push': {
                'history': {
                    'action':    action,
                    'by':        uid,
                    'by_name':   caller.get('name', ''),
                    'remarks':   remarks,
                    'timestamp': datetime.utcnow().isoformat(),
                }
            }
        }
    )
    return jsonify({'message': f'Documents {new_status}.', 'new_status': new_status}), 200


# ── HR: docs by employee ─────────────────────────────────────────────────────

@documents_bp.route('/by-employee/<emp_id>', methods=['GET'])
@jwt_required()
def docs_by_employee(emp_id):
    db  = current_app.db
    uid = get_jwt_identity()
    caller = db.users.find_one({'_id': ObjectId(uid)})
    if not caller or caller.get('role') not in ('hr_head', 'admin', 'hr'):
        return jsonify({'error': 'Access denied'}), 403

    linked_user = db.users.find_one({'employee_ref': emp_id})
    if not linked_user:
        return jsonify({'docs': [], 'submission': None, 'doc_count': 0}), 200

    target_uid = str(linked_user['_id'])
    docs = list(db.documents.find({'user_id': target_uid}))
    for d in docs:
        d['_id'] = str(d['_id'])

    sub = db.doc_submissions.find_one({'user_id': target_uid}, sort=[('submitted_at', -1)])
    if sub:
        sub['_id'] = str(sub['_id'])

    return jsonify({'docs': docs, 'submission': sub, 'doc_count': len(docs)}), 200