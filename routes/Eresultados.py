from flask import Blueprint, render_template, redirect, jsonify, request
from utils import login_required

bp = Blueprint('Eresultados', __name__)

@bp.route('/Eresultados')
@login_required
def Eresultados():
    return render_template("Eresultados.html")



