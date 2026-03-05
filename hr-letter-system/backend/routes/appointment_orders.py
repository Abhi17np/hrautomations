"""
appointment_orders.py
Routes:
  GET    /api/appointment-orders/          list all (HR/admin) or own (employee)
  GET    /api/appointment-orders/<id>      get single
  POST   /api/appointment-orders/          create draft (employee submits details)
  POST   /api/appointment-orders/<id>/submit   submit draft → pending_hr_head
  POST   /api/appointment-orders/<id>/hr-action  HR Head approve/reject
  GET    /api/appointment-orders/<id>/download   download DOCX or PDF
  DELETE /api/appointment-orders/<id>      delete draft/rejected (admin/hr_head)

Appointment Order lifecycle:
  draft → pending_hr_head → approved/rejected
  On approval: DOCX generated from template with employee's filled details.
"""

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
import os

from services.letter_generator import generate_letter_docx, generate_letter_pdf

appointment_orders_bp = Blueprint('appointment_orders', __name__)

DELETABLE_STATUSES = {'draft', 'rejected'}


def serialize(doc):
    doc['_id'] = str(doc['_id'])
    return doc


def _get_caller(db, uid):
    user = db.users.find_one({'_id': ObjectId(uid)})
    if not user:
        return None, (jsonify({'error': 'User not found'}), 404)
    return user, None


def _enrich(order, db):
    order['_id'] = str(order['_id'])
    try:
        emp = db.employees.find_one({'_id': ObjectId(order.get('employee_id', ''))})
        order['employee_name'] = emp.get('name', 'Unknown') if emp else 'Unknown'
        order['employee_code'] = emp.get('employee_id', '') if emp else ''
    except Exception:
        order['employee_name'] = 'Unknown'
        order['employee_code'] = ''
    order.pop('docx_path', None)
    order.pop('pdf_path', None)
    return order


@appointment_orders_bp.route('/', methods=['GET'])
@jwt_required()
def list_orders():
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _get_caller(db, uid)
    if err: return err

    query = {}
    # Employees see only their own appointment orders
    if caller.get('role') == 'employee':
        emp_ref = caller.get('employee_ref', '')
        query['employee_id'] = emp_ref

    status = request.args.get('status')
    if status:
        query['status'] = status

    orders = list(db.appointment_orders.find(query).sort('created_at', -1))
    return jsonify([_enrich(o, db) for o in orders])


@appointment_orders_bp.route('/<oid>', methods=['GET'])
@jwt_required()
def get_order(oid):
    db  = current_app.db
    o   = db.appointment_orders.find_one({'_id': ObjectId(oid)})
    if not o: return jsonify({'error': 'Not found'}), 404
    return jsonify(_enrich(o, db))


@appointment_orders_bp.route('/', methods=['POST'])
@jwt_required()
def create_order():
    """
    Employee submits their details to create a draft Appointment Order.
    Details collected: name, designation, department, date_of_joining,
    date_of_birth, address, reference_number (auto), extra_fields.
    """
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _get_caller(db, uid)
    if err: return err

    data = request.json or {}

    # Determine employee_id — employee role gets it from their user record
    if caller.get('role') == 'employee':
        employee_id = caller.get('employee_ref', '')
    else:
        employee_id = data.get('employee_id', '')

    if not employee_id:
        return jsonify({'error': 'employee_id is required'}), 400

    emp = db.employees.find_one({'_id': ObjectId(employee_id)})
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    # Auto-generate reference number: AO-EMP001-001
    existing = db.appointment_orders.count_documents({'employee_id': employee_id})
    ref_num  = f"AO-{emp.get('employee_id', 'EMP')}-{str(existing + 1).zfill(3)}"

    details = {
        'employee_name':       data.get('employee_name') or emp.get('name', ''),
        'employee_id_code':    emp.get('employee_id', ''),
        'designation':         data.get('designation') or emp.get('designation', ''),
        'department':          data.get('department') or emp.get('department', ''),
        'date_of_joining':     data.get('date_of_joining') or emp.get('joining_date', ''),
        'date_of_birth':       data.get('date_of_birth', ''),
        'address':             data.get('address') or emp.get('address', ''),
        'phone':               data.get('phone') or emp.get('phone', ''),
        'email':               data.get('email') or emp.get('email', ''),
        'father_name':         data.get('father_name', ''),
        'blood_group':         data.get('blood_group', ''),
        'emergency_contact':   data.get('emergency_contact', ''),
        'reference_number':    ref_num,
        'company_name':        data.get('company_name', 'Acme Corp'),
        'hr_signatory_name':   data.get('hr_signatory_name', ''),
        'hr_signatory_designation': data.get('hr_signatory_designation', 'HR Manager'),
        'date':                datetime.now().strftime('%d-%m-%Y'),
        **data.get('extra_fields', {}),
    }

    doc = {
        'employee_id':      employee_id,
        'reference_number': ref_num,
        'status':           'draft',
        'details':          details,
        'approval_history': [],
        'created_by':       uid,
        'created_at':       datetime.utcnow(),
    }
    result = db.appointment_orders.insert_one(doc)
    return jsonify({'id': str(result.inserted_id), 'reference_number': ref_num}), 201


@appointment_orders_bp.route('/<oid>/submit', methods=['POST'])
@jwt_required()
def submit_order(oid):
    """Submit draft → pending_hr_head."""
    db  = current_app.db
    uid = get_jwt_identity()
    o   = db.appointment_orders.find_one({'_id': ObjectId(oid)})
    if not o: return jsonify({'error': 'Appointment order not found'}), 404
    if o['status'] != 'draft':
        return jsonify({'error': 'Only draft orders can be submitted'}), 400

    db.appointment_orders.update_one({'_id': ObjectId(oid)}, {
        '$set':  {'status': 'pending_hr_head', 'updated_at': datetime.utcnow()},
        '$push': {'approval_history': {
            'user_id': uid, 'action': 'submitted',
            'from': 'draft', 'to': 'pending_hr_head',
            'timestamp': datetime.utcnow().isoformat(),
        }},
    })
    return jsonify({'message': 'Submitted to HR Head for approval'})


@appointment_orders_bp.route('/<oid>/hr-action', methods=['POST'])
@jwt_required()
def hr_action(oid):
    """
    HR Head approves or rejects appointment order.
    On approval: generate DOCX from the Appointment Order template.
    POST { action, remarks, template_id, hr_signatory_name?, hr_signatory_designation? }
    """
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _get_caller(db, uid)
    if err: return err
    if caller.get('role') not in ('hr_head', 'admin'):
        return jsonify({'error': 'Only HR Head or Admin can approve appointment orders'}), 403

    o = db.appointment_orders.find_one({'_id': ObjectId(oid)})
    if not o: return jsonify({'error': 'Not found'}), 404
    if o['status'] != 'pending_hr_head':
        return jsonify({'error': f"Status is '{o['status']}', not pending_hr_head"}), 400

    data    = request.json or {}
    act     = data.get('action')
    remarks = data.get('remarks', '').strip()

    if act not in ('approve', 'reject'):
        return jsonify({'error': "action must be 'approve' or 'reject'"}), 400
    if act == 'reject' and not remarks:
        return jsonify({'error': 'Rejection reason is required'}), 400

    new_status = 'approved' if act == 'approve' else 'rejected'

    update_ops = {
        '$set':  {'status': new_status, 'updated_at': datetime.utcnow()},
        '$push': {'approval_history': {
            'user_id': uid, 'user_name': caller.get('name', ''),
            'role': caller.get('role'), 'action': act,
            'from': 'pending_hr_head', 'to': new_status,
            'remarks': remarks, 'timestamp': datetime.utcnow().isoformat(),
        }},
    }

    # On approval: generate the appointment order DOCX
    if act == 'approve':
        tmpl_id = data.get('template_id')
        if not tmpl_id:
            # Look for any active 'appointment_order' type template
            tmpl = db.templates.find_one({'type': 'appointment_order', 'is_active': True})
        else:
            tmpl = db.templates.find_one({'_id': ObjectId(tmpl_id)})

        if tmpl:
            details = o.get('details', {})
            # Allow HR Head to override signatory on approval
            if data.get('hr_signatory_name'):
                details['hr_signatory_name'] = data['hr_signatory_name']
            if data.get('hr_signatory_designation'):
                details['hr_signatory_designation'] = data['hr_signatory_designation']
            details['approval_date'] = datetime.now().strftime('%d-%m-%Y')

            year    = datetime.now().strftime('%Y')
            out_dir = os.path.join(current_app.config['STORAGE_ROOT'], 'appointment_orders', year)
            os.makedirs(out_dir, exist_ok=True)

            ref  = o.get('reference_number', str(oid))
            base = ref.replace('/', '-').replace(' ', '_')
            docx_path = os.path.join(out_dir, base + '.docx')
            pdf_path  = os.path.join(out_dir, base + '.pdf')

            try:
                generate_letter_docx(tmpl['file_path'], details, docx_path)
                pdf_result = generate_letter_pdf(docx_path, pdf_path)
                update_ops['$set']['docx_path']  = docx_path
                update_ops['$set']['pdf_path']   = pdf_result
                update_ops['$set']['template_id']= str(tmpl['_id'])
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f'AO doc generation failed: {e}')

    db.appointment_orders.update_one({'_id': ObjectId(oid)}, update_ops)
    return jsonify({'message': f'Appointment order {act}d', 'new_status': new_status})


@appointment_orders_bp.route('/<oid>/download', methods=['GET'])
@jwt_required()
def download(oid):
    db  = current_app.db
    fmt = request.args.get('format', 'docx')
    o   = db.appointment_orders.find_one({'_id': ObjectId(oid)})
    if not o: return jsonify({'error': 'Not found'}), 404
    if o.get('status') != 'approved':
        return jsonify({'error': 'Appointment order must be approved before downloading'}), 400
    if fmt == 'pdf' and o.get('pdf_path') and os.path.exists(o['pdf_path']):
        return send_file(o['pdf_path'], as_attachment=True, download_name=f"{o.get('reference_number', 'AO')}.pdf")
    if o.get('docx_path') and os.path.exists(o['docx_path']):
        return send_file(o['docx_path'], as_attachment=True, download_name=f"{o.get('reference_number', 'AO')}.docx")
    return jsonify({'error': 'File not found'}), 404


@appointment_orders_bp.route('/<oid>', methods=['DELETE'])
@jwt_required()
def delete_order(oid):
    db  = current_app.db
    uid = get_jwt_identity()
    caller, err = _get_caller(db, uid)
    if err: return err
    if caller.get('role') not in ('admin', 'hr_head'):
        return jsonify({'error': 'Only Admin or HR Head can delete appointment orders'}), 403
    o = db.appointment_orders.find_one({'_id': ObjectId(oid)})
    if not o: return jsonify({'error': 'Not found'}), 404
    if o['status'] not in DELETABLE_STATUSES:
        return jsonify({'error': f"Cannot delete a '{o['status']}' order"}), 400
    for pk in ('docx_path', 'pdf_path'):
        fp = o.get(pk)
        if fp and os.path.exists(fp):
            try: os.remove(fp)
            except OSError: pass
    db.appointment_orders.delete_one({'_id': ObjectId(oid)})
    return jsonify({'message': 'Appointment order deleted'})