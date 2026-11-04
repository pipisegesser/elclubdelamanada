import pymysql

# Conexión al servidor MySQL local (usuario root sin contraseña)
conexion = pymysql.connect(
    host='localhost',
    user='root',
    password='2239fran'
)

try:
    with conexion.cursor() as cursor:
        # Crea la base de datos si no existe
        cursor.execute("CREATE DATABASE IF NOT EXISTS el_club_de_la_manada;")
        print("¡Base de datos 'el_club_de_la_manada' creada con éxito!")
finally:
    conexion.close()