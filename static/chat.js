// Identidad del usuario: nombre y uuid_client. Se guardan en sessionStorage para que no se pierdan al recargar la pagina.
if (!sessionStorage.getItem("username") || !sessionStorage.getItem("uuid_client")) {
    // Si no hay usuario en sessionStorage, pedimos uno al usuario.
    const username = prompt("Nombre de usuario");
    const uuid_client = crypto.randomUUID();
    sessionStorage.setItem("username", username);
    sessionStorage.setItem("uuid_client", uuid_client);
}

const username = sessionStorage.getItem("username");
const uuid_client = sessionStorage.getItem("uuid_client");


// Poner el foco en el input de mensaje al cargar la pagina.
window.addEventListener("load", () => {
    const input = document.getElementById("message-input");
    input.focus();
});


// Construimos la URL WebSocket segun el protocolo de la pagina actual.
// Si la pagina va por https, el socket debe ir por wss.
const scheme = window.location.protocol === "https:" ? "wss" : "ws";
const querystring = `username=${encodeURIComponent(username)}&id=${uuid_client}`;
const wsUrl = `${scheme}://${window.location.host}/ws?${querystring}`;

const socket = new WebSocket(wsUrl);
const log = document.getElementById("log");
const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const status = document.getElementById("status");

function colorFromUsername(value) {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = value.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = 60 * (hash % 6);
    console.log(`Color for ${value}: hsl(${hue}, 30%, 50%)`);
	return `hsl(${hue}, 30%, 50%)`;
}

function addLine(msgtype, sender, text) {
	const div = document.createElement("div");
	div.className = "line " + msgtype;

	if (msgtype === "system") {
		div.textContent = text;
	} else {
		const spanUserText = document.createElement("span");
		spanUserText.className = "username";
		spanUserText.style.color = colorFromUsername(sender);
		spanUserText.textContent = sender;

		const messageText = document.createElement("span");
		messageText.textContent = text;

		div.appendChild(spanUserText);
		div.appendChild(messageText);
	}

	log.appendChild(div);
	requestAnimationFrame(() => {
		div.scrollIntoView({ block: "end" });
		log.scrollTop = log.scrollHeight;
	});
}

socket.addEventListener("open", () => {
	status.textContent = "Estado: conectado";
	addLine("system", null, "Conexion WebSocket abierta");
});

socket.addEventListener("message", (event) => {
	const data = JSON.parse(event.data);
	console.log(data, username, data.username, username == data.username);
	if (data.type == "system") {
		addLine("system", null, data.message);
	} else if (data.username == username) {
		addLine("me", username, data.message);
	} else {
		addLine("user", data.username, data.message);
	}
});

socket.addEventListener("close", () => {
	status.textContent = "Estado: desconectado";
	addLine("system", null, "Conexion WebSocket cerrada");
});

socket.addEventListener("error", () => {
	status.textContent = "Estado: error de conexion";
	addLine("system", null, "Error en WebSocket");
});

form.addEventListener("submit", (event) => {
	event.preventDefault();

	const message = input.value.trim();
	if (!message) return;

	// Enviamos texto plano; en una app real podrias usar JSON.
	socket.send(message);
	input.value = "";
	input.focus();
});
