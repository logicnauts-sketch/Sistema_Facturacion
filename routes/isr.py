from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('isr', __name__)

@bp.route('/isr')
@login_required
def isr():
    return render_template("isr.html")



