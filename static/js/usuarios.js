document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('userModal');
    const newUserBtn = document.getElementById('newUserBtn');
    const closeBtn = document.querySelector('.close-btn');
    const cancelBtn = document.getElementById('cancelBtn');
    const userForm = document.getElementById('userForm');
    const refreshBtn = document.getElementById('refreshBtn');
    const filterSelect = document.getElementById('filterSelect');
    const usersTable = document.getElementById('usersTable').querySelector('tbody');

    // Abrir modal para nuevo usuario
    newUserBtn.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Crear Nuevo Usuario';
        userForm.reset();
        document.getElementById('userId').value = '';
        document.getElementById('password').required = true;
        document.getElementById('confirmPassword').required = true;
        modal.style.display = 'flex';
    });

    // Cerrar modal
    function closeModal() {
        modal.style.display = 'none';
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Enviar formulario (crear o actualizar)
    userForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const userId = document.getElementById('userId').value;
        const isEdit = userId !== '';

        const name = document.getElementById('name').value;
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const role = document.getElementById('role').value;
        const status = document.getElementById('status').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validar contraseñas solo para nuevo usuario
        if (!isEdit) {
            if (password !== confirmPassword) {
                alert('Las contraseñas no coinciden');
                return;
            }
            if (password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres');
                return;
            }
        }

        const userData = {
            nombre: name,
            username: username,
            email: email,
            rol: role,
            estado: status
        };

        // Solo incluir contraseña si se proporciona en edición
        if (password && isEdit) {
            userData.password = password;
        } else if (!isEdit) {
            userData.password = password;
        }

        const url = isEdit ? `/usuarios/${userId}` : '/usuarios';
        const method = isEdit ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                closeModal();
                loadUsers();
                showToast(isEdit ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
            } else {
                showToast(data.error || 'Error al guardar el usuario', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(error.error || 'Error en la conexión', 'error');
        });
    });

    // Cargar usuarios
    function loadUsers() {
        let url = '/usuarios/data';
        const filter = filterSelect.value;
        
        // Aplicar filtro si no es "all"
        if (filter !== 'all') {
            url += `?estado=${filter}`;
        }

        fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar usuarios');
            }
            return response.json();
        })
        .then(users => {
            usersTable.innerHTML = '';
            users.forEach(user => {
                const tr = document.createElement('tr');
                
                // Mapear roles a nombres más legibles
                const roleMap = {
                    'admin': 'Administrador',
                    'usuario': 'Usuario',
                    'cliente': 'Cliente',
                    'staff': 'Personal'
                };
                
                // Determinar clase CSS para el rol
                const roleClass = `role-${user.rol}`;
                
                tr.innerHTML = `
                    <td>${user.nombre_completo}</td>
                    <td>${user.email}</td>
                    <td><span class="role-badge ${roleClass}">${roleMap[user.rol] || user.rol}</span></td>
                    <td><span class="status ${user.estado === 'Activo' ? 'status-active' : 'status-inactive'}">${user.estado}</span></td>
                    <td>${user.creado_en}</td>
                    <td class="actions">
                        <button class="action-btn edit" data-id="${user.id}"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" data-id="${user.id}"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                usersTable.appendChild(tr);
            });

            // Agregar eventos a los botones de editar y eliminar
            document.querySelectorAll('.edit').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userId = this.getAttribute('data-id');
                    editUser(userId);
                });
            });

            document.querySelectorAll('.delete').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userId = this.getAttribute('data-id');
                    deleteUser(userId);
                });
            });
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error al cargar usuarios', 'error');
        });
    }

    // Editar usuario
    function editUser(userId) {
        fetch(`/usuarios/${userId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener el usuario');
            }
            return response.json();
        })
        .then(user => {
            if (user.error) {
                showToast(user.error, 'error');
                return;
            }
            
            document.getElementById('modalTitle').textContent = 'Editar Usuario';
            document.getElementById('userId').value = user.id;
            document.getElementById('name').value = user.nombre;
            document.getElementById('username').value = user.username;
            document.getElementById('email').value = user.email;
            document.getElementById('role').value = user.rol;
            document.getElementById('status').value = user.estado;
            
            // Quitar requerimiento de contraseña en edición
            document.getElementById('password').required = false;
            document.getElementById('confirmPassword').required = false;
            
            // Limpiar campos de contraseña
            document.getElementById('password').value = '';
            document.getElementById('confirmPassword').value = '';
            
            modal.style.display = 'flex';
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error al cargar el usuario', 'error');
        });
    }

    // Eliminar usuario
    function deleteUser(userId) {
        if (confirm('¿Está seguro que desea eliminar este usuario?')) {
            fetch(`/usuarios/${userId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    loadUsers();
                    showToast('Usuario eliminado correctamente', 'success');
                } else {
                    showToast(data.error || 'Error al eliminar el usuario', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast(error.error || 'Error en la conexión', 'error');
            });
        }
    }

    // Mostrar notificaciones
    function showToast(message, type) {
        // Eliminar toast existente si hay alguno
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Mostrar toast
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        // Ocultar después de 3 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Evento para el botón de actualizar
    refreshBtn.addEventListener('click', loadUsers);

    // Evento para el filtro
    filterSelect.addEventListener('change', loadUsers);

    // Cargar usuarios al inicio
    loadUsers();
});