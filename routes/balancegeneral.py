from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('balancegeneral', __name__)

@bp.route('/balancegeneral')
@login_required
def balancegeneral():
    return render_template("balancegeneral.html")



