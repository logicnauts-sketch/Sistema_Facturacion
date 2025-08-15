from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('libromayor', __name__)

@bp.route('/libromayor')
@login_required
def libromayor():
    return render_template("libromayor.html")



