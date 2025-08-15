document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const bubblesContainer = document.getElementById('bubbles');
    
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
    
    // Manejar el envío del formulario
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
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
                // Redirección exitosa
                loginButton.innerHTML = '<i class="fas fa-check"></i> Acceso concedido';
                setTimeout(() => {
                    window.location.href = '/home';
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