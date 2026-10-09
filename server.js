const authRoutes = require('./src/routes/auth');
const authMiddleware = require('./src/middleware/auth');
require('dotenv').config();
const express = require('express');
const pool = require('./src/db');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (error) {
        console.error('Error checking health:', error);
        res.status(500).json({ status: 'error', message: 'No se pudo conectar' });
    }
});

app.use('/api/auth', authRoutes);

app.get('/api/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, balance FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

const walletRoutes = require('./src/routes/wallet');

app.use('/api/wallet', authMiddleware, walletRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});