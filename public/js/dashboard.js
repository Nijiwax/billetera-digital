// Sin token no hay nada que ver: volver al login
if (!getToken()) {
    window.location.href = '/index.html';
}

const messageBox = document.getElementById('message');

function showMessage(text, type = 'success') {
    messageBox.textContent = text;
    messageBox.className = `alert alert-${type}`;
}

function formatMoney(value) {
    return '$' + Number(value).toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function createCell(text, className = '') {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
}

async function loadProfile() {
    const user = await apiFetch('/me');
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('balance').textContent = formatMoney(user.balance);
}

async function loadBalance() {
    const data = await apiFetch('/wallet/balance');
    document.getElementById('balance').textContent = formatMoney(data.balance);
}

function renderTransactions(transactions) {
    const body = document.getElementById('transactions-body');
    body.replaceChildren();

    if (transactions.length === 0) {
        const tr = document.createElement('tr');
        const td = createCell('Aún no tienes movimientos', 'text-center text-muted');
        td.colSpan = 3;
        tr.appendChild(td);
        body.appendChild(tr);
        return;
    }

    transactions.forEach((t) => {
        let detail;
        if (t.type === 'deposit') {
            detail = 'Depósito';
        } else if (t.direction === 'out') {
            detail = `Enviado a ${t.receiver_name}`;
        } else {
            detail = `Recibido de ${t.sender_name}`;
        }

        const isIncoming = t.direction === 'in';
        const sign = isIncoming ? '+' : '-';
        const colorClass = isIncoming ? 'text-success' : 'text-danger';

        const tr = document.createElement('tr');
        tr.appendChild(createCell(new Date(t.created_at).toLocaleString('es-CL')));
        tr.appendChild(createCell(detail));
        tr.appendChild(createCell(`${sign}${formatMoney(t.amount)}`, `text-end fw-semibold ${colorClass}`));
        body.appendChild(tr);
    });
}

async function loadTransactions() {
    const transactions = await apiFetch('/wallet/transactions');
    renderTransactions(transactions);
}

async function refresh() {
    await Promise.all([loadBalance(), loadTransactions()]);
}

// Envía un formulario, bloqueando el botón mientras espera la respuesta
async function handleSubmit(event, path, buildBody) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
        const data = await apiFetch(path, {
            method: 'POST',
            body: JSON.stringify(buildBody()),
        });
        showMessage(data.message, 'success');
        form.reset();
        await refresh();
    } catch (error) {
        showMessage(error.message, 'danger');
    } finally {
        button.disabled = false;
    }
}

document.getElementById('deposit-form').addEventListener('submit', (event) =>
    handleSubmit(event, '/wallet/deposit', () => ({
        amount: document.getElementById('deposit-amount').value,
    }))
);

document.getElementById('transfer-form').addEventListener('submit', (event) =>
    handleSubmit(event, '/wallet/transfer', () => ({
        receiver_email: document.getElementById('transfer-email').value.trim(),
        amount: document.getElementById('transfer-amount').value,
    }))
);

document.getElementById('logout-button').addEventListener('click', logout);

// Carga inicial
(async () => {
    try {
        await Promise.all([loadProfile(), loadTransactions()]);
    } catch (error) {
        showMessage(error.message, 'danger');
    }
})();