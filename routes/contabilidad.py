from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('contabilidad', __name__)

@bp.route('/contabilidad')
@login_required
def contabilidad():
    return render_template("contabilidad.html")



