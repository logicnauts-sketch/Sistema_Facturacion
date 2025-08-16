document.addEventListener('DOMContentLoaded', function() {
    // Inicializar Notyf para notificaciones
    const notyf = new Notyf({
        duration: 5000,
        position: {
            x: 'right',
            y: 'top',
        },
        types: [
            {
                type: 'success',
                background: '#28a745',
                icon: {
                    className: 'fas fa-check-circle',
                    tagName: 'i',
                    color: '#fff'
                },
                dismissible: true
            },
            {
                type: 'error',
                background: '#dc3545',
                icon: {
                    className: 'fas fa-exclamation-circle',
                    tagName: 'i',
                    color: '#fff'
                },
                dismissible: true
            },
            {
                type: 'info',
                background: '#17a2b8',
                icon: {
                    className: 'fas fa-info-circle',
                    tagName: 'i',
                    color: '#fff'
                },
                dismissible: true
            }
        ]
    });

    // Elementos del DOM
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

        const name = document.getElementById('name').value.trim();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const role = document.getElementById('role').value;
        const status = document.getElementById('status').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validar campos obligatorios
        if (!name || !username || !email) {
            notyf.error('Por favor complete todos los campos obligatorios');
            return;
        }

        // Validar contraseñas solo para nuevo usuario
        if (!isEdit) {
            if (password !== confirmPassword) {
                notyf.error('Las contraseñas no coinciden');
                return;
            }
            if (password.length < 6) {
                notyf.error('La contraseña debe tener al menos 6 caracteres');
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
                return response.json().then(err => { 
                    throw new Error(err.error || 'Error en la solicitud'); 
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                closeModal();
                loadUsers();
                notyf.success(isEdit ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
            } else {
                throw new Error(data.error || 'Error al guardar el usuario');
            }
        })
        .catch(error => {
            notyf.error(error.message || 'Error en la conexión');
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
            
            // Filtrar usuarios: excluir el primer usuario (ID 1)
            const filteredUsers = users.filter(user => user.id !== 1);
            
            filteredUsers.forEach(user => {
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
            notyf.error('Error al cargar usuarios: ' + error.message);
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
                notyf.error(user.error);
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
            notyf.error('Error al cargar el usuario: ' + error.message);
        });
    }

    // Eliminar usuario con SweetAlert
    function deleteUser(userId) {
        // Prevenir eliminación del usuario con ID 1
        if (userId == 1) {
            notyf.error('No se puede eliminar este usuario');
            return;
        }
        
        // Mostrar confirmación con SweetAlert
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¡No podrás revertir esta acción!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            backdrop: 'rgba(0,0,0,0.5)'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(`/usuarios/${userId}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { 
                            throw new Error(err.error || 'Error en la solicitud'); 
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        loadUsers();
                        notyf.success('Usuario eliminado correctamente');
                    } else {
                        throw new Error(data.error || 'Error al eliminar el usuario');
                    }
                })
                .catch(error => {
                    notyf.error(error.message || 'Error en la conexión');
                });
            }
        });
    }

    // Evento para el botón de actualizar
    refreshBtn.addEventListener('click', loadUsers);

    // Evento para el filtro
    filterSelect.addEventListener('change', loadUsers);

    // Cargar usuarios al inicio
    loadUsers();
});