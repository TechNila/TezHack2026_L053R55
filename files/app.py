"""
ScholarSetu -- Flask + SQLite backend.

Run with:  python app.py
Then open: http://127.0.0.1:5000/

Default admin login (preset, not self-serve):
    username: admin
    password: admin123
"""

import json
import sqlite3
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory, url_for, render_template
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = "database.db"

app = Flask(__name__, static_folder=".", static_url_path="") # removed 
app.secret_key = "dev-secret-key-change-this-in-production"


# ---------------------------------------------------------------------------
# Fixed rule fields -- weights are set here, never by the admin.
# gpa/income = 3, course/category = 2, state/age = 1
# ---------------------------------------------------------------------------

FIELD_WEIGHTS = {
    "gpa": 3,
    "income": 3,
    "course": 2,
    "category": 2,
    "state": 1,
    "age": 1,
}

FIELD_LABELS = {
    "gpa": "Minimum GPA",
    "income": "Maximum annual income",
    "course": "Course level",
    "category": "Reservation category",
    "state": "Eligible state",
    "age": "Maximum age",
}

# Gen at the top (least reservation), ST at the bottom (most reservation).
# A scholarship's rule value is the highest (topmost) tier that qualifies;
# a student qualifies if their own tier is at or below that line.
CATEGORY_ORDER = ["gen", "gen-ews", "obc", "sc", "st"]
COURSE_LEVELS = ["school", "ug", "pg", "diploma", "phd"]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            state TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            institution_name TEXT,
            annual_income INTEGER NOT NULL,
            gpa REAL NOT NULL,
            category TEXT NOT NULL,
            course TEXT NOT NULL,
            age INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scholarships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            institution TEXT NOT NULL,
            deadline TEXT NOT NULL,
            description TEXT,
            notice_link TEXT,
            required_documents TEXT NOT NULL DEFAULT '[]',
            rules TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS checklist (
            student_id INTEGER NOT NULL,
            scholarship_id INTEGER NOT NULL,
            checked_documents TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (student_id, scholarship_id),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE CASCADE
        );
        """
    )
    row = conn.execute("SELECT COUNT(*) AS c FROM admin").fetchone()
    if row["c"] == 0:
        conn.execute(
            "INSERT INTO admin (username, password_hash) VALUES (?, ?)",
            ("admin", generate_password_hash("admin123")),
        )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Auth decorators
# ---------------------------------------------------------------------------

def student_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "student_id" not in session:
            return jsonify({"error": "Not logged in"}), 401
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "admin_id" not in session:
            return jsonify({"error": "Not logged in"}), 401
        return f(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Rule validation (admin side)
# ---------------------------------------------------------------------------

def validate_rules(raw_rules):
    """Returns (clean_rules, error_message_or_None)."""
    if not isinstance(raw_rules, list) or len(raw_rules) == 0:
        return None, "Add at least one eligibility rule."

    seen_fields = set()
    clean = []
    for r in raw_rules:
        field = r.get("field")
        value = r.get("value")
        if field not in FIELD_WEIGHTS:
            return None, f"Unknown rule field: {field}"
        if field in seen_fields:
            return None, f"Rule field '{field}' can only be used once per scholarship."
        seen_fields.add(field)

        if field in ("gpa", "income", "age"):
            try:
                value = float(value) if field == "gpa" else int(value)
            except (ValueError, TypeError):
                return None, f"'{FIELD_LABELS[field]}' must be a number."
        elif field == "category":
            value = str(value).strip().lower()
            if value not in CATEGORY_ORDER:
                return None, "Category rule value must be one of: " + ", ".join(CATEGORY_ORDER)
        elif field == "course":
            value = str(value).strip().lower()
            if value not in COURSE_LEVELS:
                return None, "Course rule value must be one of: " + ", ".join(COURSE_LEVELS)
        elif field == "state":
            value = str(value).strip()
            if not value:
                return None, "State rule value can't be empty."

        clean.append({"field": field, "value": value})

    return clean, None


# ---------------------------------------------------------------------------
# Eligibility logic (student side)
# ---------------------------------------------------------------------------

def evaluate_rule(field, value, student):
    """Returns (passed: bool, detail: str) for a single rule against a student."""
    if field == "gpa":
        passed = student["gpa"] >= value
        detail = f"your GPA is {student['gpa']}, needed at least {value}" if not passed \
            else f"your GPA of {student['gpa']} meets the minimum of {value}"
        return passed, detail

    if field == "income":
        passed = student["annual_income"] <= value
        detail = f"your family income is \u20B9{student['annual_income']:,}, ceiling is \u20B9{value:,}" if not passed \
            else f"your family income of \u20B9{student['annual_income']:,} is within the \u20B9{value:,} ceiling"
        return passed, detail

    if field == "state":
        student_state = student["state"].strip().lower()
        ok = value.strip().lower() == "all" or value.strip().lower() == student_state
        detail = f"open to {value}, your registered state is {student['state']}" if not ok \
            else f"open to your state ({student['state']})"
        return ok, detail

    if field == "age":
        passed = student["age"] <= value
        detail = f"your age is {student['age']}, maximum allowed is {value}" if not passed \
            else f"your age ({student['age']}) is within the limit of {value}"
        return passed, detail

    if field == "category":
        student_idx = CATEGORY_ORDER.index(student["category"])
        rule_idx = CATEGORY_ORDER.index(value)
        passed = student_idx >= rule_idx
        detail = f"open up to {value.upper()}, your category is {student['category'].upper()}" if not passed \
            else f"your category ({student['category'].upper()}) qualifies (open up to {value.upper()})"
        return passed, detail

    if field == "course":
        passed = student["course"] == value
        detail = f"open to {value.upper()} students, you're registered as {student['course'].upper()}" if not passed \
            else f"open to your course level ({student['course'].upper()})"
        return passed, detail

    return False, "unknown rule"


def compute_eligibility(student, rules):
    """Returns (status, score_percent, rule_results[]).
    status: 'eligible' | 'possible' | 'not-eligible'
      - all rules pass -> eligible
      - no rule with weight >= 2 passes (only weight-1 rules, or none) -> not-eligible
      - anything else -> possible
    """
    rule_results = []
    total_weight = 0
    passed_weight = 0
    any_heavy_passed = False
    all_passed = True

    for r in rules:
        field = r["field"]
        weight = FIELD_WEIGHTS[field]
        passed, detail = evaluate_rule(field, r["value"], student)
        rule_results.append({
            "field": field,
            "label": FIELD_LABELS[field],
            "weight": weight,
            "passed": passed,
            "detail": detail,
        })
        total_weight += weight
        if passed:
            passed_weight += weight
            if weight >= 2:
                any_heavy_passed = True
        else:
            all_passed = False

    score = round((passed_weight / total_weight) * 100) if total_weight else 0

    if all_passed:
        status = "eligible"
    elif any_heavy_passed:
        status = "possible"
    else:
        status = "not-eligible"

    return status, score, rule_results


# ---------------------------------------------------------------------------
# Static pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    # return send_from_directory(app.static_folder, "home.html")
    return render_template('home.html')

@app.route("/home.html")
def load_home():
    return render_template('home.html')

@app.route("/admin-login.html")
def load_admin_login():
    return render_template('admin-login.html')
    
@app.route("/student-login.html")
def load_student_login():
    return render_template('student-login.html')

@app.route("/add-scholarship.html")
def load_add_scholarship():
    return render_template('add-scholarship.html')

@app.route("/student-dash.html")
def load_student_dash():
    return render_template('student-dash.html')



# ---------------------------------------------------------------------------
# Student auth
# ---------------------------------------------------------------------------

STUDENT_SIGNUP_FIELDS = [
    "name", "username", "password", "state", "phone",
    "email", "institution_name", "annual_income",
    "gpa", "category", "course", "age",
]


@app.route("/api/student/signup", methods=["POST"])
def student_signup():
    data = request.get_json(silent=True) or {}
    missing = [f for f in STUDENT_SIGNUP_FIELDS if str(data.get(f, "")).strip() == ""]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        income = int(data["annual_income"])
        gpa = float(data["gpa"])
        age = int(data["age"])
    except (ValueError, TypeError):
        return jsonify({"error": "Income, GPA, and age must be numbers"}), 400

    category = str(data["category"]).strip().lower()
    if category not in CATEGORY_ORDER:
        return jsonify({"error": "Category must be one of: " + ", ".join(CATEGORY_ORDER)}), 400

    course = str(data["course"]).strip().lower()
    if course not in COURSE_LEVELS:
        return jsonify({"error": "Course level must be one of: " + ", ".join(COURSE_LEVELS)}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM students WHERE username = ?", (data["username"],)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "That username is already taken"}), 409

    conn.execute(
        """INSERT INTO students
           (name, username, password_hash, state, phone, email, institution_name,
            annual_income, gpa, category, course, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data["name"], data["username"], generate_password_hash(data["password"]),
            data["state"], data["phone"], data["email"], data["institution_name"],
            income, gpa, category, course, age,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Account created. You can now log in."}), 201


@app.route("/api/student/login", methods=["POST"])
def student_login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    conn = get_db()
    student = conn.execute("SELECT * FROM students WHERE username = ?", (username,)).fetchone()
    conn.close()

    if not student or not check_password_hash(student["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    session.clear()
    session["student_id"] = student["id"]
    return jsonify({"message": "Logged in", "name": student["name"]})


@app.route("/api/student/logout", methods=["POST"])
def student_logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/student/me")
@student_required
def student_me():
    conn = get_db()
    s = conn.execute(
        "SELECT id, name, username, state, phone, email, institution_name, "
        "annual_income, gpa, category, course, age FROM students WHERE id = ?",
        (session["student_id"],),
    ).fetchone()
    conn.close()
    return jsonify(dict(s))


# ---------------------------------------------------------------------------
# Admin auth (preset single account, no self-serve creation)
# ---------------------------------------------------------------------------

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    conn = get_db()
    admin = conn.execute("SELECT * FROM admin WHERE username = ?", (username,)).fetchone()
    conn.close()

    if not admin or not check_password_hash(admin["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    session.clear()
    session["admin_id"] = admin["id"]
    return jsonify({"message": "Logged in", "username": admin["username"]})


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.clear()
    return jsonify({"message": "Logged out"})


# ---------------------------------------------------------------------------
# Scholarships (admin: create, list, update)
# ---------------------------------------------------------------------------

def scholarship_row_to_dict(row):
    d = dict(row)
    d["required_documents"] = json.loads(d["required_documents"])
    d["rules"] = json.loads(d["rules"])
    return d


@app.route("/api/admin/scholarships", methods=["GET", "POST"])
@admin_required
def admin_scholarships():
    conn = get_db()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        error = _save_scholarship(conn, data)
        if error:
            conn.close()
            return jsonify({"error": error}), 400
        conn.commit()
        conn.close()
        return jsonify({"message": "Scholarship added"}), 201

    rows = conn.execute("SELECT * FROM scholarships ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([scholarship_row_to_dict(r) for r in rows])


@app.route("/api/admin/scholarships/<int:scholarship_id>", methods=["PUT"])
@admin_required
def admin_update_scholarship(scholarship_id):
    conn = get_db()
    existing = conn.execute("SELECT id FROM scholarships WHERE id = ?", (scholarship_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Scholarship not found"}), 404

    data = request.get_json(silent=True) or {}
    error = _save_scholarship(conn, data, scholarship_id=scholarship_id)
    if error:
        conn.close()
        return jsonify({"error": error}), 400
    conn.commit()
    conn.close()
    return jsonify({"message": "Scholarship updated"})


@app.route("/api/admin/scholarships/<int:scholarship_id>", methods=["DELETE"])
@admin_required
def admin_delete_scholarship(scholarship_id):
    conn = get_db()
    conn.execute("DELETE FROM scholarships WHERE id = ?", (scholarship_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Scholarship deleted"})


BASIC_FIELDS = ["name", "institution", "deadline", "description", "notice_link"]


def _save_scholarship(conn, data, scholarship_id=None):
    missing = [f for f in BASIC_FIELDS if not str(data.get(f, "")).strip()]
    if missing:
        return f"Missing fields: {', '.join(missing)}"

    docs = data.get("required_documents")
    if isinstance(docs, str):
        docs = [d.strip() for d in docs.split(",") if d.strip()]
    if not isinstance(docs, list) or len(docs) == 0:
        return "Add at least one required document."

    rules, rule_error = validate_rules(data.get("rules"))
    if rule_error:
        return rule_error

    if scholarship_id is None:
        conn.execute(
            """INSERT INTO scholarships
               (name, institution, deadline, description, notice_link, required_documents, rules)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                data["name"], data["institution"], data["deadline"], data["description"],
                data["notice_link"], json.dumps(docs), json.dumps(rules),
            ),
        )
    else:
        conn.execute(
            """UPDATE scholarships
               SET name = ?, institution = ?, deadline = ?, description = ?,
                   notice_link = ?, required_documents = ?, rules = ?
               WHERE id = ?""",
            (
                data["name"], data["institution"], data["deadline"], data["description"],
                data["notice_link"], json.dumps(docs), json.dumps(rules), scholarship_id,
            ),
        )
    return None


@app.route("/api/scholarships")
@student_required
def student_scholarships():
    conn = get_db()
    student = conn.execute("SELECT * FROM students WHERE id = ?", (session["student_id"],)).fetchone()
    scholarships = conn.execute("SELECT * FROM scholarships ORDER BY id").fetchall()
    checklist_rows = conn.execute(
        "SELECT * FROM checklist WHERE student_id = ?", (session["student_id"],)
    ).fetchall()
    conn.close()

    checklist_map = {row["scholarship_id"]: json.loads(row["checked_documents"]) for row in checklist_rows}

    result = []
    for sch in scholarships:
        sch_dict = scholarship_row_to_dict(sch)
        status, score, rule_results = compute_eligibility(student, sch_dict["rules"])
        sch_dict["eligibility"] = status
        sch_dict["score"] = score
        sch_dict["rule_results"] = rule_results
        sch_dict["added_to_checklist"] = sch["id"] in checklist_map
        sch_dict["checked_documents"] = checklist_map.get(sch["id"], [])
        result.append(sch_dict)

    return jsonify(result)


# ---------------------------------------------------------------------------
# Checklist
# ---------------------------------------------------------------------------

@app.route("/api/checklist/<int:scholarship_id>/add", methods=["POST"])
@student_required
def checklist_add(scholarship_id):
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO checklist (student_id, scholarship_id, checked_documents) VALUES (?, ?, '[]')",
        (session["student_id"], scholarship_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Added to checklist"})


@app.route("/api/checklist/<int:scholarship_id>/remove", methods=["POST"])
@student_required
def checklist_remove(scholarship_id):
    conn = get_db()
    conn.execute(
        "DELETE FROM checklist WHERE student_id = ? AND scholarship_id = ?",
        (session["student_id"], scholarship_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Removed from checklist"})


@app.route("/api/checklist/<int:scholarship_id>/document", methods=["POST"])
@student_required
def checklist_toggle_document(scholarship_id):
    data = request.get_json(silent=True) or {}
    document = data.get("document")
    checked = bool(data.get("checked"))
    if not document:
        return jsonify({"error": "document is required"}), 400

    conn = get_db()
    row = conn.execute(
        "SELECT checked_documents FROM checklist WHERE student_id = ? AND scholarship_id = ?",
        (session["student_id"], scholarship_id),
    ).fetchone()
    if row is None:
        conn.close()
        return jsonify({"error": "Scholarship is not in your checklist yet"}), 404

    docs = set(json.loads(row["checked_documents"]))
    if checked:
        docs.add(document)
    else:
        docs.discard(document)

    conn.execute(
        "UPDATE checklist SET checked_documents = ? WHERE student_id = ? AND scholarship_id = ?",
        (json.dumps(sorted(docs)), session["student_id"], scholarship_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"checked_documents": sorted(docs)})


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(host='0.0.0.0', port=5100)