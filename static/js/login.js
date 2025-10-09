document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('remember');
    const bubblesContainer = document.getElementById('bubbles');
    const savedSessionsContainer = document.getElementById('saved-sessions');
    const savedUsersList = document.getElementById('saved-users-list');
    
    // Cargar sesiones guardadas al iniciar
    loadSavedSessions();
    
    // Crear burbujas animadas para el fondo
    function createBubbles() {
        const bubbleCount = 15;
        
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            
            // Tamaño aleatorio
            const size = Math.random() * 100 + 20;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            
            // Posición aleatoria
            bubble.style.left = `${Math.random() * 100}%`;
            bubble.style.bottom = `-${size}px`;
            
            // Retraso de animación aleatorio
            bubble.style.animationDelay = `${Math.random() * 10}s`;
            bubble.style.animationDuration = `${Math.random() * 20 + 10}s`;
            
            bubblesContainer.appendChild(bubble);
        }
    }
    
    // Función para mostrar mensajes de error
    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    };
    
    // Función para guardar sesión
    function saveSession(username) {
        // Obtener sesiones guardadas actuales
        const savedSessions = JSON.parse(localStorage.getItem('facturapro_saved_sessions')) || [];
        
        // Verificar si el usuario ya está guardado
        const existingUserIndex = savedSessions.findIndex(session => session.username === username);
        
        if (existingUserIndex === -1) {
            // Agregar nuevo usuario con fecha
            savedSessions.push({
                username: username,
                savedAt: new Date().toISOString()
            });
            
            // Guardar en localStorage
            localStorage.setItem('facturapro_saved_sessions', JSON.stringify(savedSessions));
            
            // Recargar la lista de sesiones guardadas
            loadSavedSessions();
        }
    }
    
    // Función para cargar sesiones guardadas
    function loadSavedSessions() {
        // Obtener sesiones guardadas
        const savedSessions = JSON.parse(localStorage.getItem('facturapro_saved_sessions')) || [];
        
        // Limpiar lista actual
        savedUsersList.innerHTML = '';
        
        if (savedSessions.length === 0) {
            // Mostrar mensaje si no hay sesiones guardadas
            savedSessionsContainer.style.display = 'none';
            return;
        }
        
        // Mostrar el contenedor de sesiones guardadas
        savedSessionsContainer.style.display = 'block';
        
        // Crear elementos para cada sesión guardada
        savedSessions.forEach(session => {
            const listItem = document.createElement('li');
            listItem.className = 'saved-user';
            
            // Obtener iniciales del usuario
            const initials = session.username.substring(0, 2).toUpperCase();
            
            listItem.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar">${initials}</div>
                    <span class="user-name">${session.username}</span>
                </div>
                <div class="user-actions">
                    <button class="delete-session" data-username="${session.username}" title="Eliminar sesión guardada">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            // Agregar evento para cargar usuario
            listItem.querySelector('.user-info').addEventListener('click', () => {
                usernameInput.value = session.username;
                passwordInput.focus();
            });
            
            // Agregar evento para eliminar sesión
            listItem.querySelector('.delete-session').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevenir que se active el evento del elemento padre
                deleteSession(session.username);
            });
            
            savedUsersList.appendChild(listItem);
        });
    }
    
    // Función para eliminar sesión guardada
    function deleteSession(username) {
        // Obtener sesiones guardadas actuales
        const savedSessions = JSON.parse(localStorage.getItem('facturapro_saved_sessions')) || [];
        
        // Filtrar para eliminar la sesión
        const updatedSessions = savedSessions.filter(session => session.username !== username);
        
        // Guardar en localStorage
        localStorage.setItem('facturapro_saved_sessions', JSON.stringify(updatedSessions));
        
        // Recargar la lista de sesiones guardadas
        loadSavedSessions();
    }
    
    // Manejar el envío del formulario
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const remember = rememberCheckbox.checked;
        
        // Validación básica
        if (!username) {
            showError('Por favor ingrese su usuario');
            usernameInput.focus();
            return;
        }
        
        if (!password) {
            showError('Por favor ingrese su contraseña');
            passwordInput.focus();
            return;
        }
        
        // Mostrar mensaje de carga
        const loginButton = loginForm.querySelector('.btn-login');
        const originalButtonText = loginButton.innerHTML;
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
        loginButton.disabled = true;
        
        try {
            // Enviar datos al servidor
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Si se marcó "Recordar sesión", guardar la sesión
                if (remember) {
                    saveSession(username);
                }
                
                // Redirección exitosa
                loginButton.innerHTML = '<i class="fas fa-check"></i> Acceso concedido';
                
                setTimeout(() => {
                    // Redirigir según el rol del usuario
                    if (data.rol === 'empleado') {
                        window.location.href = '/facturacion';
                    } else {
                        window.location.href = '/home';
                    }
                }, 1000);
            } else {
                // Mostrar error del servidor
                showError(data.error || 'Error de autenticación');
                loginButton.innerHTML = originalButtonText;
                loginButton.disabled = false;
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error de conexión con el servidor');
            loginButton.innerHTML = originalButtonText;
            loginButton.disabled = false;
        }
    });
    
    // Limpiar mensaje de error al escribir
    usernameInput.addEventListener('input', () => {
        errorMessage.style.display = 'none';
    });
    
    passwordInput.addEventListener('input', () => {
        errorMessage.style.display = 'none';
    });
    
    // Efecto de enfoque en los campos
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.parentElement.style.transform = 'scale(1.02)';
        });
        
        input.addEventListener('blur', () => {
            input.parentElement.parentElement.style.transform = 'scale(1)';
        });
    });
    
    // Inicializar burbujas
    createBubbles();
});
