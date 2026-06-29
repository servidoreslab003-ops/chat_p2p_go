const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ruta del archivo usuarios.json
const USUARIOS_FILE = path.join(__dirname, 'usuarios.json');

// ============================================
// FUNCIONES
// ============================================

function leerUsuarios() {
    try {
        if (fs.existsSync(USUARIOS_FILE)) {
            const data = fs.readFileSync(USUARIOS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Error al leer:', error.message);
    }
    return { usuarios: [] };
}

function guardarUsuarios(data) {
    try {
        fs.writeFileSync(USUARIOS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error al guardar:', error.message);
        return false;
    }
}

// ============================================
// ENDPOINTS
// ============================================

// OBTENER todos los usuarios (GET)
app.get('/usuarios', (req, res) => {
    const data = leerUsuarios();
    res.json(data);
});

// GUARDAR o ACTUALIZAR usuario (POST) - CON CONTRASEÑA
app.post('/usuarios', (req, res) => {
    console.log('📥 POST recibido:', req.body); // <--- LOG PARA DEBUG
    
    const { id, nombre, password, peer_id } = req.body;
    
    if (!id || !nombre) {
        return res.status(400).json({ error: 'Faltan id o nombre' });
    }
    
    const data = leerUsuarios();
    
    let usuario = data.usuarios.find(u => u.id === id);
    
    if (usuario) {
        // Actualizar usuario existente
        usuario.nombre = nombre;
        if (password) usuario.password = password; // Solo si se envía
        usuario.peer_id = peer_id || null;
        usuario.ultimo_activo = new Date().toISOString();
        console.log(`✏️ Usuario actualizado: ${nombre}`);
    } else {
        // Crear nuevo usuario
        usuario = {
            id: id,
            nombre: nombre,
            password: password || '',
            peer_id: peer_id || null,
            ultimo_activo: new Date().toISOString()
        };
        data.usuarios.push(usuario);
        console.log(`✅ Usuario creado: ${nombre}`);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, usuario });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ACTUALIZAR peer_id (PUT)
app.put('/usuarios/:id', (req, res) => {
    const { peer_id } = req.body;
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === req.params.id);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    usuario.peer_id = peer_id || null;
    usuario.ultimo_activo = new Date().toISOString();
    console.log(`🔄 Peer ID actualizado: ${usuario.nombre} -> ${peer_id}`);
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, usuario });
    } else {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// ELIMINAR usuario (DELETE)
app.delete('/usuarios/:id', (req, res) => {
    const data = leerUsuarios();
    const index = data.usuarios.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    data.usuarios.splice(index, 1);
    
    if (guardarUsuarios(data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// Estado del servidor
app.get('/status', (req, res) => {
    const data = leerUsuarios();
    const enLinea = data.usuarios.filter(u => u.peer_id && u.peer_id !== null);
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        total_usuarios: data.usuarios.length,
        usuarios_en_linea: enLinea.length,
        usuarios: data.usuarios.map(u => ({ 
            nombre: u.nombre, 
            peer_id: u.peer_id,
            tiene_password: !!u.password 
        }))
    });
});

// ============================================
// INICIAR
// ============================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor de usuarios.json corriendo en puerto ${PORT}`);
    console.log(`📄 GET  /usuarios  - Obtener todos los usuarios`);
    console.log(`📝 POST /usuarios  - Guardar/Actualizar usuario (con password)`);
    console.log(`✏️  PUT  /usuarios/:id - Actualizar peer_id`);
    console.log(`🗑️  DELETE /usuarios/:id - Eliminar usuario`);
    console.log(`📊 GET  /status    - Estado del servidor`);
});
