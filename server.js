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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});