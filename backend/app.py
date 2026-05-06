from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from pymongo import MongoClient
from datetime import timedelta
import os

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config['JWT_SECRET_KEY']            = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-in-prod')
app.config['JWT_ACCESS_TOKEN_EXPIRES']  = timedelta(hours=8)
app.config['STORAGE_ROOT']              = os.path.join(os.getcwd(), 'storage')
app.config['UPLOAD_FOLDER']             = os.path.join(os.getcwd(), 'storage')
app.config['MONGO_URI']                 = os.getenv('MONGO_URI', 'mongodb://localhost:27017/hr_offer_letters')

for d in ['templates', 'letters', 'documents', 'previews']:
    os.makedirs(os.path.join(app.config['STORAGE_ROOT'], d), exist_ok=True)

jwt    = JWTManager(app)
client = MongoClient(app.config['MONGO_URI'])
app.db = client.hr_offer_letters

from routes.auth               import auth_bp
from routes.employees          import employees_bp
from routes.templates          import templates_bp
from routes.letters            import letters_bp
from routes.approvals          import approvals_bp
from routes.exit               import exit_bp
from routes.appointment_orders import appointment_orders_bp
from routes.documents          import documents_bp

app.register_blueprint(auth_bp,               url_prefix='/api/auth')
app.register_blueprint(employees_bp,          url_prefix='/api/employees')
app.register_blueprint(templates_bp,          url_prefix='/api/templates')
app.register_blueprint(letters_bp,            url_prefix='/api/letters')
app.register_blueprint(approvals_bp,          url_prefix='/api/approvals')
app.register_blueprint(exit_bp,               url_prefix='/api/exit')
app.register_blueprint(appointment_orders_bp, url_prefix='/api/appointment-orders')
app.register_blueprint(documents_bp,          url_prefix='/api/documents')

@app.errorhandler(404)
def not_found(e):    return {'error': 'Not found'}, 404

@app.errorhandler(500)
def server_error(e): return {'error': 'Internal server error'}, 500

# ── TEST ONLY — remove before production ─────────────────────────────────────
from flask import jsonify
@app.route('/api/test-scheduler')
def test_scheduler():
    from scheduler import run_checks_now
    return jsonify(run_checks_now(app))

# ── Start background scheduler (birthday + anniversary emails) ────────────────
from scheduler import start_scheduler
start_scheduler(app)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)