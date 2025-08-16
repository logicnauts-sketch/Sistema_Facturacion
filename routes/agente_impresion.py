from flask import Flask, request, jsonify
import cups
import os
import tempfile

app = Flask(__name__)
API_TOKEN = "november"  # Debe coincidir con TOKEN_AGENTE

def auth(req):
    return req.headers.get("X-Api-Token") == API_TOKEN

@app.route("/print", methods=["POST"])
def print_text():
    if not auth(request):
        return jsonify({"success": False, "error": "unauthorized"}), 401
    
    text = request.json.get("text", "")
    printer_name = request.json.get("printer")
    
    try:
        conn = cups.Connection()
        printers = conn.getPrinters()
        
        if not printer_name:
            printer_name = conn.getDefault()
        
        if not printer_name or printer_name not in printers:
            return jsonify({
                "success": False,
                "error": f"Impresora no encontrada: {printer_name}",
                "available_printers": list(printers.keys())
            }), 400

        # Crear archivo temporal
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as temp_file:
            temp_file.write(text)
            temp_file_path = temp_file.name
        
        # Enviar a imprimir
        job_id = conn.printFile(printer_name, temp_file_path, "Ticket Factura", {})
        os.unlink(temp_file_path)  # Eliminar archivo temporal
        
        if job_id > 0:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "No se pudo enviar a la impresora"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)