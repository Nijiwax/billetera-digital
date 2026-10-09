const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Ruta registro usuario
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, balance, created_at',
            [name, email.toLowerCase(), passwordHash]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Violacion de UNIQUE constraint (correo electrónico duplicado)
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta login usuario
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'El correo electrónico y la contraseña son obligatorios' });
    }

    try {
        const result = await pool.query(
            'SELECT id, name, email, password_hash FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        const user = result.rows[0];

        const passwordOk = user && await bcrypt.compare(password, user.password_hash);

        if (!passwordOk) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});


module.exports = router;