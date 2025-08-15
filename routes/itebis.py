from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('itebis', __name__)

@bp.route('/itebis')
@login_required
def itebis():
    return render_template("itebis.html")



