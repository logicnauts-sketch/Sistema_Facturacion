# auth.py
from functools import wraps
from flask import flash, redirect, url_for, session

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

        # CORRECCIÓN: Usar 'rol' en lugar de 'user_role'
        if session.get('rol') != 'admin':
            flash('Acceso permitido solo para administradores.', 'danger')
            
            # Redirigir a la página adecuada según el rol
            if session.get('rol') == 'empleado':
                return redirect(url_for('facturacion.facturacion'))
            else:
                return redirect(url_for('home.home'))

        return f(*args, **kwargs)
    return decorated_function