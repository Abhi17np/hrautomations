"""
scheduler.py — Daily birthday and work anniversary email sender
Runs as a background thread started when Flask app boots.
Checks every day at 09:00 AM server time for:
  - Employees whose birthday is today → sends birthday wish
  - Employees whose joining_date anniversary is today → sends work anniversary wish
"""

import threading
import time
import logging
import os
import smtplib
from datetime import datetime, date, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

log = logging.getLogger(__name__)


def _send_email(to_email: str, subject: str, body: str):
    smtp_host = os.getenv('SMTP_HOST', '')
    smtp_user = os.getenv('SMTP_USER', '')
    smtp_pass = os.getenv('SMTP_PASS', '')
    smtp_port = int(os.getenv('SMTP_PORT', 587))
    from_addr = os.getenv('SMTP_FROM') or smtp_user
    company   = os.getenv('COMPANY_NAME', 'Infopace Management Pvt Ltd')

    if not smtp_host or not smtp_user:
        log.warning('Scheduler: SMTP not configured — skipping email to %s', to_email)
        return False

    try:
        msg = MIMEMultipart()
        msg['From']    = f'{company} HR <{from_addr}>'
        msg['To']      = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.ehlo(); s.starttls(); s.ehlo()
            s.login(smtp_user, smtp_pass)
            s.sendmail(from_addr, to_email, msg.as_string())

        log.info('Scheduler: email sent to %s — %s', to_email, subject)
        return True

    except Exception as e:
        log.error('Scheduler: email failed to %s — %s', to_email, e)
        return False


def _parse_date(d_str: str):
    if not d_str or not isinstance(d_str, str):
        return None
    d_str = d_str.strip()
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(d_str, fmt)
        except ValueError:
            continue
    return None


def _years_completed(join_dt: datetime, today: date) -> int:
    years = today.year - join_dt.year
    if (today.month, today.day) < (join_dt.month, join_dt.day):
        years -= 1
    return years


def _ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        return f'{n}th'
    return f'{n}{["th","st","nd","rd","th","th","th","th","th","th"][n % 10]}'


def _birthday_body(name: str, company: str) -> str:
    return f"""Dear {name},

Wishing you a very Happy Birthday! 🎂

On behalf of everyone at {company}, we hope your special day is filled with joy, laughter, and wonderful memories.

Your dedication and hard work are truly appreciated. We are grateful to have you as part of our team and look forward to celebrating many more milestones together.

Warm wishes,
HR Team
{company}
"""


def _anniversary_body(name: str, years: int, company: str) -> str:
    ordinal = _ordinal(years)
    return f"""Dear {name},

Congratulations on completing your {ordinal} work anniversary at {company}! 🎉

{years} year{'s' if years > 1 else ''} of dedication, growth, and contribution — thank you for being such a valued member of our team.

Your efforts make a real difference every day, and we look forward to many more successful years together.

With appreciation,
HR Team
{company}
"""


def run_daily_checks(app):
    company = os.getenv('COMPANY_NAME', 'Infopace Management Pvt Ltd')

    while True:
        now    = datetime.now()
        target = now.replace(hour=9, minute=0, second=0, microsecond=0)

        if now >= target:
            # Already past 9 AM — schedule for tomorrow using timedelta (safe for month-end)
            target = target + timedelta(days=1)

        wait_seconds = (target - now).total_seconds()
        log.info('Scheduler: next run in %.0f seconds (at %s)', wait_seconds, target)
        time.sleep(wait_seconds)

        today = date.today()
        log.info('Scheduler: running daily checks for %s', today)

        try:
            with app.app_context():
                db = app.db

                users = list(db.users.find({
                    'is_active': {'$ne': False},
                    'employee_ref': {'$exists': True, '$ne': ''},
                }))

                sent_birthday    = 0
                sent_anniversary = 0

                for user in users:
                    work_email = user.get('email', '')
                    name       = user.get('name', 'Team Member')
                    emp_ref    = user.get('employee_ref')

                    if not work_email:
                        continue

                    try:
                        from bson import ObjectId
                        emp = db.employees.find_one({'_id': ObjectId(emp_ref)})
                    except Exception:
                        emp = None

                    if not emp:
                        continue

                    # ── Birthday check ────────────────────────────────────
                    # Checks user.birthday → emp.birthday → emp.date_of_birth (set by Step 1 form)
                    bday_str = (user.get('birthday')
                                or emp.get('birthday')
                                or emp.get('date_of_birth', ''))
                    bday_dt = _parse_date(bday_str)
                    if bday_dt and bday_dt.month == today.month and bday_dt.day == today.day:
                        sent = _send_email(
                            to_email=work_email,
                            subject=f'Happy Birthday, {name.split()[0]}! 🎂',
                            body=_birthday_body(name, company),
                        )
                        if sent:
                            sent_birthday += 1
                            db.scheduler_log.insert_one({
                                'type': 'birthday', 'user_id': str(user['_id']),
                                'to_email': work_email, 'name': name,
                                'sent_at': datetime.utcnow(), 'date': today.isoformat(),
                            })

                    # ── Work anniversary check ────────────────────────────
                    join_str = emp.get('joining_date', '')
                    join_dt  = _parse_date(join_str)
                    if join_dt and join_dt.month == today.month and join_dt.day == today.day:
                        years = _years_completed(join_dt, today)
                        if years >= 1:
                            sent = _send_email(
                                to_email=work_email,
                                subject=f'Happy {_ordinal(years)} Work Anniversary, {name.split()[0]}! 🎉',
                                body=_anniversary_body(name, years, company),
                            )
                            if sent:
                                sent_anniversary += 1
                                db.scheduler_log.insert_one({
                                    'type': 'anniversary', 'user_id': str(user['_id']),
                                    'to_email': work_email, 'name': name, 'years': years,
                                    'sent_at': datetime.utcnow(), 'date': today.isoformat(),
                                })

                log.info('Scheduler: done — %d birthday, %d anniversary emails sent',
                         sent_birthday, sent_anniversary)

        except Exception as e:
            log.error('Scheduler: daily check failed — %s', e)

        # Safety sleep before recalculating next target
        time.sleep(60)

def run_checks_now(app):
    """Test function — runs the daily check immediately and returns a summary."""
    from datetime import date
    from bson import ObjectId
    
    today = date.today()
    company = os.getenv('COMPANY_NAME', 'Infopace Management Pvt Ltd')
    results = []

    with app.app_context():
        db = app.db
        users = list(db.users.find({
            'is_active': {'$ne': False},
            'employee_ref': {'$exists': True, '$ne': ''},
        }))

        for user in users:
            work_email = user.get('email', '')
            name = user.get('name', '')
            emp_ref = user.get('employee_ref')
            try:
                emp = db.employees.find_one({'_id': ObjectId(emp_ref)})
            except Exception:
                emp = None
            if not emp:
                continue

            bday_str = user.get('birthday') or emp.get('birthday') or emp.get('date_of_birth', '')
            bday_dt  = _parse_date(bday_str)
            join_str = emp.get('joining_date', '')
            join_dt  = _parse_date(join_str)

            results.append({
                'name':          name,
                'email':         work_email,
                'birthday':      bday_str,
                'bday_match':    bool(bday_dt and bday_dt.month == today.month and bday_dt.day == today.day),
                'joining_date':  join_str,
                'anniv_match':   bool(join_dt and join_dt.month == today.month and join_dt.day == today.day),
            })

    return {'today': today.isoformat(), 'checked': len(results), 'employees': results}


def start_scheduler(app):
    t = threading.Thread(target=run_daily_checks, args=(app,), daemon=True)
    t.start()
    log.info('Scheduler: background thread started')