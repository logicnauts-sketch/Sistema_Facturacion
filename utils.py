# auth.py
from functools import wraps
from flask import redirect, session, url_for, flash

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Debes iniciar sesión para acceder a esta página', 'warning')
            return redirect(url_for('login.login'))
        return f(*args, **kwargs)
    return decorated_function

def solo_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Debes iniciar sesión para acceder a esta página', 'warning')
            return redirect(url_for('login.login'))

        if session.get('user_role') != 'admin':
            flash('Acceso permitido solo para administradores.', 'danger')
            return redirect(url_for('home.home'))  # o la ruta que uses para usuarios normales

        return f(*args, **kwargs)
    return decorated_function
