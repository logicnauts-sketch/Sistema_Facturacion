from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('balanceeyi', __name__)

@bp.route('/balanceeyi')
@login_required
def balanceeyi():
    return render_template("balanceeyi.html")



