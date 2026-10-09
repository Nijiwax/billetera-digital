const express = require('express');
const pool = require('../db');
const router = express.Router();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function handleError(res, error) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  } 
  console.log(error);
  return res.status(500).json({ message: 'Error en el servidor' });
}

function parseAmount(value) {
    const text = String(value ?? '');
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        throw new HttpError(400, 'El monto debe ser un número positivo con hasta dos decimales');
}
const amount = Number(text);
if (amount <= 0) {
    throw new HttpError(400, 'El monto debe ser mayor que cero');
}
if (amount > 1000000) {
    throw new HttpError(400, 'El monto máximo por transacción es de 1,000,000');
}
return amount;
}

//Ejecuta una funcion dentro de una transaccion SQL
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }finally {
    client.release();
  } 
}

//Saldo de la billetera
router.get('/balance', async (req, res) => {
try {
  const result = await pool.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
  res.json({ balance: result.rows[0].balance });
} catch (error) {
  handleError(res, error);
}
});

//Añadir dinero a la billetera
router.post('/deposit', async (req, res) => {
  try {
    const amount = parseAmount(req.body.amount);

    const balance = await withTransaction(async (client) => {
        const updated = await client.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
            [amount, req.user.id]
        );
        await client.query(
            `INSERT INTO transactions (sender_id, receiver_id, amount, type) VALUES (NULL, $1, $2, 'deposit')`,
            [req.user.id, amount]
        );
        return updated.rows[0].balance;
    });
    res.status(201).json({ message: 'Depósito realizado con éxito', balance });
    } catch (error) {
      handleError(res, error);
    }
});

//Enviar dinero a otra billetera
router.post('/transfer', async (req, res) => {
  try {
    const amount = parseAmount(req.body.amount);
    const email = String(req.body.receiver_email || '').toLowerCase().trim();
    if (!email) {
      throw new HttpError(400, 'El correo electrónico del receptor es obligatorio');
    }

    const result = await withTransaction(async (client) => {
      const senderId = req.user.id;

      const receiver = await client.query('SELECT id, name FROM users WHERE email = $1', [email]
      );
      if (receiver.rowCount === 0) {
        throw new HttpError(404, 'El receptor no existe');
      }
      const receiverId = receiver.rows[0].id;

      if (receiverId === senderId) {
        throw new HttpError(400, 'No puedes transferir dinero a tu propia billetera');
      }

      //Bloquea ambas filas, siempre en el mismo orden, para evitar bloqueos cruzados
      await client.query('SELECT id FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE', [[senderId, receiverId]]
      );

      const debit = await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
        [amount, senderId]
      );
      if (debit.rowCount === 0) {
        throw new HttpError(400, 'Saldo insuficiente para realizar la transferencia');
      }

      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, receiverId]
      );

      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, receiverId]
      );

      await client.query(
        `INSERT INTO transactions (sender_id, receiver_id, amount, type) VALUES ($1, $2, $3, 'transfer')`,
        [senderId, receiverId, amount]
      );

      return { balance: debit.rows[0].balance, receiverName: receiver.rows[0].name };
    });

    res.status(201).json({ message: `Transferencia realizada con éxito a ${result.receiverName}`, balance: result.balance });
  } catch (error) {
    handleError(res, error);
  }
});

//Historial de transacciones
router.get('/transactions', async (req, res) => {
  try {
    const result = await pool.query(
        `SELECT t.id, t.type, t.amount, t.created_at,
                CASE WHEN t.receiver_id = $1 THEN 'in' ELSE 'out' END AS direction,
                s.name AS sender_name, s.email AS sender_email,
                r.name AS receiver_name, r.email AS receiver_email
        FROM transactions t
        LEFT JOIN users s ON s.id = t.sender_id
        JOIN users r ON r.id = t.receiver_id
        WHERE t.sender_id = $1 OR t.receiver_id = $1
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;