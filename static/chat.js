// Identidad del usuario en sessionStorage. Se puede editar desde el formulario.
let username = sessionStorage.getItem("username") || "";
let uuid_client = sessionStorage.getItem("uuid_client") || crypto.randomUUID();
sessionStorage.setItem("uuid_client", uuid_client);

const log = document.getElementById("log");
const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const status = document.getElementById("status");
const identityForm = document.getElementById("identity-form");
const usernameInput = document.getElementById("username-input");
const cancelIdentityButton = document.getElementById("cancel-identity-btn");
const toggleIdentityButton = document.getElementById("toggle-identity-btn");
const currentUsernameLabel = document.getElementById("current-username-label");

let socket = null;

function setIdentityModalOpen(isOpen) {
	identityForm.hidden = !isOpen;
	document.body.classList.toggle("identity-modal-open", isOpen);
	if (isOpen) {
		usernameInput.value = username;
		setTimeout(() => usernameInput.focus(), 0);
	}
}

function updateIdentitySummary() {
	if (username) {
		currentUsernameLabel.textContent = `Usuario: ${username}`;
		toggleIdentityButton.textContent = "Cambiar usuario";
	} else {
		currentUsernameLabel.textContent = "Usuario: sin definir";
		toggleIdentityButton.textContent = "Establecer usuario";
	}
}

function updateIdentityUI() {
	updateIdentitySummary();
	usernameInput.value = username;
	const hasUser = Boolean(username);
	input.disabled = !hasUser;
	if (hasUser) {
		status.textContent = socket && socket.readyState === WebSocket.OPEN
			? "Estado: conectado"
			: "Estado: conectando...";
	} else {
		status.textContent = "Estado: define un usuario";
	}
}

function getWsUrl() {
	const scheme = window.location.protocol === "https:" ? "wss" : "ws";
	const querystring = `username=${encodeURIComponent(username)}&id=${uuid_client}`;
	return `${scheme}://${window.location.host}/ws?${querystring}`;
}

function disconnectSocket() {
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		socket.close();
	}
	socket = null;
}

function colorFromUsername(value) {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = value.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = 60 * (hash % 6);
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

function connectSocket() {
	if (!username) {
		updateIdentityUI();
		return;
	}

	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return;
	}

	socket = new WebSocket(getWsUrl());

	socket.addEventListener("open", () => {
		updateIdentityUI();
		addLine("system", null, "Conexion WebSocket abierta");
		if (!identityForm.hidden) return;
		input.focus();
	});

	socket.addEventListener("message", (event) => {
		const data = JSON.parse(event.data);
		if (data.type === "system") {
			addLine("system", null, data.message);
		} else if (data.username === username) {
			addLine("me", username, data.message);
		} else {
			addLine("user", data.username, data.message);
		}
	});

	socket.addEventListener("close", () => {
		if (username) {
			status.textContent = "Estado: desconectado";
			addLine("system", null, "Conexion WebSocket cerrada");
		} else {
			updateIdentityUI();
		}
	});

	socket.addEventListener("error", () => {
		status.textContent = "Estado: error de conexion";
		addLine("system", null, "Error en WebSocket");
	});
}

identityForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const nextUsername = usernameInput.value.trim();
	if (!nextUsername) {
		usernameInput.focus();
		return;
	}

	const hasChanged = nextUsername !== username;
	username = nextUsername;
	sessionStorage.setItem("username", username);

	if (hasChanged) {
		disconnectSocket();
	}

	setIdentityModalOpen(false);
	updateIdentityUI();
	connectSocket();
});

toggleIdentityButton.addEventListener("click", () => {
	setIdentityModalOpen(true);
});

cancelIdentityButton.addEventListener("click", () => {
	if (!username) {
		usernameInput.focus();
		return;
	}
	setIdentityModalOpen(false);
	input.focus();
});

form.addEventListener("submit", (event) => {
	event.preventDefault();

	const message = input.value.trim();
	if (!message) return;
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		status.textContent = "Estado: desconectado";
		return;
	}

	// Enviamos texto plano; en una app real podrias usar JSON.
	socket.send(message);
	input.value = "";
	input.focus();
});

updateIdentityUI();
if (username) {
	setIdentityModalOpen(false);
	connectSocket();
	window.addEventListener("load", () => input.focus());
} else {
	setIdentityModalOpen(true);
	window.addEventListener("load", () => usernameInput.focus());
}
