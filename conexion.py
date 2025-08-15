import mariadb

def conectar():
    try:
        conn = mariadb.connect(
            user="root",
            password="1234",
            host="localhost",
            port=3306,
            database="mini_market"
        )
        return conn
    except mariadb.Error as e:
        print(f"Error al conectarse a la base de datos: {e}")
        return None
