from flask import Blueprint, render_template, request, session, flash, redirect, url_for, jsonify
from conexion import conectar
from werkzeug.security import check_password_hash

bp = Blueprint('login', __name__)

@bp.route('/login', methods=['GET', 'POST'])
def login():
    # Manejar solicitudes AJAX
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
     
        conn = None
        cursor = None
        try:
            conn = conectar()
            cursor = conn.cursor()
            cursor.execute("SELECT id, password, nombre_completo, rol FROM usuarios WHERE username = %s", (username,))
            user = cursor.fetchone()
            
            if user and check_password_hash(user[1], password):
                session['user_id'] = user[0]
                session['nombre_completo'] = user[2]
                session['rol'] = user[3]
                
                nombres = user[2].split()
                session['iniciales'] = ''.join([name[0] for name in nombres[:2]]).upper()
                
                return jsonify(success=True)
            else:
                return jsonify(success=False, error='Credenciales inválidas'), 401
        except Exception as e:
            return jsonify(success=False, error=f'Error en el sistema: {str(e)}'), 500
        finally:
            if cursor: cursor.close()
            if conn: conn.close()
    
    # Manejar solicitudes normales POST
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = None
        cursor = None
        try:
            conn = conectar()
            cursor = conn.cursor()
            cursor.execute("SELECT id, password, nombre_completo, rol FROM usuarios WHERE username = %s", (username,))
            user = cursor.fetchone()
            
            if user and check_password_hash(user[1], password):
                session['user_id'] = user[0]
                session['nombre_completo'] = user[2]
                session['rol'] = user[3]
                
                nombres = user[2].split()
                session['iniciales'] = ''.join([name[0] for name in nombres[:2]]).upper()
                
                return redirect(url_for('home.home'))
            else:
                flash('Credenciales inválidas', 'danger')
        except Exception as e:
            flash(f'Error en el sistema: {str(e)}', 'danger')
        finally:
            if cursor: cursor.close()
            if conn: conn.close()
    
    return render_template('login.html')

@bp.route('/logout')
def logout():
    session.clear()
    flash('Has cerrado sesión correctamente', 'success')
    return redirect(url_for('login.login'))