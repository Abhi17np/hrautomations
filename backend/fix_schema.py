from dotenv import load_dotenv
load_dotenv()
import os
from pymongo import MongoClient

uri = os.getenv('MONGO_URI')
print(f"Connecting to: {uri[:50]}...")
client = MongoClient(uri)
db = client['hr_offer_letters']

for coll in ['letters', 'appointment_orders', 'templates', 'employees', 'users', 'documents', 'doc_submissions', 'exit_records']:
    try:
        db.command("collMod", coll, validator={}, validationLevel="off")
        print(f"✅ {coll} - validation removed")
    except Exception as e:
        print(f"⚠️  {coll} - {e}")

print("\n✅ All done! Restart app.py and try again.")
