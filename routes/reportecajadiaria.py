from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('reportecajadiaria', __name__)

@bp.route('/reportecajadiaria')
@login_required
def reportecajadiaria():
    return render_template("reportecajadiaria.html")



