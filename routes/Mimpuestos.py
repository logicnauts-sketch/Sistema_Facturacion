from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('Mimpuestos', __name__)

@bp.route('/Mimpuestos')
@login_required
def Mimpuestos():
    return render_template("Mimpuestos.html")



