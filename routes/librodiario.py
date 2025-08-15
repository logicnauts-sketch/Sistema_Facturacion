from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('librodiario', __name__)

@bp.route('/librodiario')
@login_required
def librodiario():
    return render_template("librodiario.html")



