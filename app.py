"""
Mini chat didactico con Starlette + WebSockets.

Objetivo de este archivo:
1) Mostrar como se sirve una pagina HTML con Starlette.
2) Mostrar el ciclo de vida de un WebSocket:
	 - conexion (accept)
	 - recepcion de mensajes
	 - envio de mensajes
	 - desconexion
3) Mantener todo en un solo archivo para que el alumno pueda seguirlo paso a paso.

Instalacion y ejecucion recomendada:
	pip install starlette uvicorn
	uvicorn app:app --reload

Luego abrir:
		http://127.0.0.1:8000
"""

from __future__ import annotations

import json
from typing import Set

from starlette.applications import Starlette
from starlette.endpoints import WebSocketEndpoint
from starlette.requests import Request
from starlette.responses import HTMLResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket


class ConnectionManager:
    """
    Gestiona las conexiones WebSocket activas.

    Esta clase centraliza la logica de "quien esta conectado" y "a quien
    se le envian mensajes", para separar responsabilidades:
    - El endpoint maneja el protocolo WebSocket.
    - El manager maneja el conjunto de clientes conectados.
    """

    def __init__(self) -> None:
            # Conjunto de sockets activos.
            # Usamos set para altas/bajas eficientes y para evitar duplicados.
            self.active_connections: Set[WebSocket] = set()

    def connect(self, websocket: WebSocket) -> None:
            """Registra una conexion como activa."""
            self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
            """Elimina una conexion del conjunto activo si existe."""
            self.active_connections.discard(websocket)

    async def broadcast(self, message: str) -> None:
            """
            Envia un mensaje de texto a todos los clientes conectados.

            Nota didactica:
            - El bucle recorre una copia (list(...)) para evitar errores si
                durante el envio algun cliente se desconecta.
            """
            for connection in list(self.active_connections):
                    await connection.send_text(message)


# Instancia global para este ejemplo sencillo.
manager = ConnectionManager()


async def homepage(_: Request) -> HTMLResponse:
    """
    Devuelve una pagina HTML minima con cliente WebSocket en JavaScript.

    La ruta HTTP sirve la interfaz y el script JS abre el WebSocket a /ws.
    """
    with open('chat.html', 'r') as file:
        html_content = file.read()

    return HTMLResponse(html_content)


class ChatWebSocketEndpoint(WebSocketEndpoint):
    """
    Endpoint WebSocket class-based.

    Ventaja didactica:
    - on_connect: muestra cuando se acepta el handshake.
    - on_receive: muestra cuando llega un mensaje.
    - on_disconnect: muestra cuando termina la sesion.
    """

    encoding = "text"

    async def on_connect(self, websocket: WebSocket) -> None:
            """
            1) Acepta la conexion WebSocket.
            2) Registra el cliente.
            3) Notifica al grupo.
            """
            await websocket.accept()
            manager.connect(websocket)
            querystring = websocket.query_params
            self.username = querystring.get("username", "Anónimo")
            self.id = querystring.get("id", "unknown")
            await manager.broadcast(json.dumps({"type": "system", "message": f"Un usuario se ha conectado: {self.username}"}))

    async def on_receive(self, websocket: WebSocket, data: str) -> None:
            """
            Procesa cada mensaje recibido del cliente actual.

            En este ejemplo el procesamiento es simple:
            - limpiar espacios al principio/final
            - ignorar mensajes vacios
            - reenviar al grupo (broadcast)
            """
            message = data.strip()
            if not message:
                    return

            await manager.broadcast(json.dumps({"type": "user", "username": self.username, "message": message}))

    async def on_disconnect(self, websocket: WebSocket, close_code: int) -> None:
            """
            Limpieza al cerrar la conexion.

            close_code indica por que se cerro el socket (normal, error, etc.).
            Aqui no lo usamos para logica, pero lo dejamos en firma para estudio.
            """
            manager.disconnect(websocket)
            await manager.broadcast(json.dumps({"type": "system", "message": f"El usuario {self.username} se ha desconectado ({self.id})"}))


# Tabla de rutas de la aplicacion.
routes = [
    Route("/", homepage),
    WebSocketRoute("/ws", ChatWebSocketEndpoint),
]


# Instancia ASGI que uvicorn usara como punto de entrada.
app = Starlette(debug=True, routes=routes)

