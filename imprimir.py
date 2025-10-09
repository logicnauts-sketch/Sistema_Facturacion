# listar_impresoras_y_imprimir.py
import win32print
import time

def listar_impresoras():
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    printers = win32print.EnumPrinters(flags)
    print("Impresoras encontradas:")
    for p in printers:
        try:
            flags, description, name, comment = p
        except ValueError:
            # estructura alternativa
            name = p[2]
            description = p[1] if len(p) > 1 else ""
        print(" -", name, "|", description)
    print("Predeterminada:", win32print.GetDefaultPrinter())

def print_raw(printer_name, raw_bytes):
    hPrinter = win32print.OpenPrinter(printer_name)
    try:
        # "RAW" para mandar los bytes directamente (ESC/POS, etc.)
        job_info = ("Ticket", None, "RAW")
        win32print.StartDocPrinter(hPrinter, 1, job_info)
        win32print.StartPagePrinter(hPrinter)
        win32print.WritePrinter(hPrinter, raw_bytes)
        win32print.EndPagePrinter(hPrinter)
        win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)

if __name__ == "__main__":
    listar_impresoras()
    # --- EJEMPLO de uso: enviar texto + inicialización + corte ---
    # Sustituye "NOMBRE_DE_TU_IMPRESORA" por el nombre exacto que te dé listar_impresoras()
    printer = "NOMBRE_DE_TU_IMPRESORA"

    texto = "FACTURA #001\nCliente: Juan Pérez\nProducto: Monitor\nPrecio: 120 USD\n\nGracias por su compra!\n\n"
    # Inicializa impresora + texto + cortar papel (ESC/POS)
    raw = b"\x1B\x40" + texto.encode("utf-8", errors="replace") + b"\n" + b"\x1D\x56\x00"
    try:
        print_raw(printer, raw)
        print("Enviado a imprimir en:", printer)
    except Exception as e:
        print("Error al imprimir:", e)
