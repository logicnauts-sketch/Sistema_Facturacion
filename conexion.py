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

def obtener_ip_agente():
    """Obtiene la IP del agente de impresión desde la base de datos"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT valor FROM configuracion WHERE clave = 'agente_ip'")
        config = cursor.fetchone()
        return config['valor'] if config else None
    except Exception as e:
        print(f"Error al obtener IP del agente: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

def guardar_ip_agente(ip):
    """Guarda la IP del agente de impresión en la base de datos"""
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO configuracion (clave, valor) 
            VALUES ('agente_ip', %s)
            ON DUPLICATE KEY UPDATE valor = %s
        """, (ip, ip))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error al guardar IP del agente: {str(e)}")
        return False
    finally:
        cursor.close()
        conn.close()