from flask import Flask, send_from_directory
from routes import home
from routes import clientes
from routes import proveedores
from routes import facturacion
from routes import productos
from routes import inventario
from routes import controlventas
from routes import contabilidad
from routes import cuentascyp
from routes import balanceeyi
from routes import librodiario
from routes import libromayor
from routes import balancegeneral
from routes import Eresultados
from routes import Mimpuestos
from routes import itebis
from routes import isr
from routes import versiones
from routes import reportecajadiaria
from routes import login
from routes import usuarios
from routes import verifone
from routes import impresora
from routes import empresa
from routes import caja
from flask_mail import Mail



app = Flask(__name__)
app.secret_key = "jul"

# Configuración de Flask-Mail
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'prestamosdelgadof@gmail.com'
app.config['MAIL_PASSWORD'] = 'bzyz uzha idyj uuvb'
app.config['MAIL_DEFAULT_SENDER'] = 'prestamosdelgadof@gmail.com'



# Inicializar Flask-Mail
mail = Mail(app)


app.register_blueprint(clientes.bp)
app.register_blueprint(home.bp)
app.register_blueprint(proveedores.bp)
app.register_blueprint(facturacion.bp)
app.register_blueprint(productos.bp)
app.register_blueprint(inventario.bp)
app.register_blueprint(controlventas.bp)
app.register_blueprint(contabilidad.bp)
app.register_blueprint(cuentascyp.bp)
app.register_blueprint(balanceeyi.bp)
app.register_blueprint(librodiario.bp)
app.register_blueprint(libromayor.bp)
app.register_blueprint(balancegeneral.bp)
app.register_blueprint(Eresultados.bp)
app.register_blueprint(Mimpuestos.bp)
app.register_blueprint(itebis.bp)
app.register_blueprint(isr.bp)
app.register_blueprint(versiones.bp)
app.register_blueprint(reportecajadiaria.bp)
app.register_blueprint(login.bp)
app.register_blueprint(usuarios.bp)
app.register_blueprint(verifone.bp)
app.register_blueprint(impresora.bp)
app.register_blueprint(empresa.bp)
app.register_blueprint(caja.bp)

if __name__ == "__main__":
    app.run(debug=True)