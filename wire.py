import re, textwrap

# --- App.js ---
t = open('frontend/src/App.js').read()
if 'Fleet' not in t:
    t = t.replace('import ManageTechs', 'import Fleet from "./pages/Fleet";
import ManageTechs')
    t = t.replace('path="techs"', 'path="fleet" element={<ProtectedRoute><Fleet /></ProtectedRoute>} />
            <Route path="techs"')
    open('frontend/src/App.js','w').write(t)
    print('App.js done')

# --- Layout.js ---
t = open('frontend/src/components/Layout.js').read()
if '/fleet' not in t:
    t = t.replace('{ to: "/techs",      label: "Technicians" },', '{ to: "/fleet",      label: "Loaner Fleet" },
    { to: "/techs",      label: "Technicians" },')
    t = t.replace('  foreman: [
    { to: "/dashboard"', '  foreman: [
    { to: "/fleet",      label: "Loaner Fleet" },
    { to: "/dashboard"')
    open('frontend/src/components/Layout.js','w').write(t)
    print('Layout.js done')

# --- main.py migration ---
t = open('backend/main.py').read()
if 'loaners table' not in t:
    patch = '        cursor.execute("CREATE TABLE IF NOT EXISTS loaners (id INTEGER PRIMARY KEY AUTOINCREMENT, unit_number TEXT NOT NULL, vin TEXT, year INTEGER, make TEXT, model TEXT, color TEXT, license_plate TEXT, current_miles INTEGER, current_fuel TEXT, status TEXT DEFAULT chr(39)available chr(39), customer_name TEXT, customer_phone TEXT, ro_number TEXT, advisor_name TEXT, checkout_date DATE, checkout_miles INTEGER, checkout_fuel TEXT, checkout_notes TEXT, checkin_date DATE, checkin_miles INTEGER, checkin_fuel TEXT, checkin_notes TEXT, damage_noted BOOLEAN DEFAULT 0, damage_notes TEXT, created_at DATETIME)")'
    patch = patch.replace('chr(39)', "'")
    patch = '        # loaners table
' + patch
    t = t.replace('        conn.commit()', patch + '
        conn.commit()', 1)
    open('backend/main.py','w').write(t)
    print('Migration done')
