const db = require("./db");

function addToInvoice(transaction_id, emoney) {
    db.execute(`INSERT INTO invoice (transaction_id, seller_emoney) VALUES (?, ?)`, [transaction_id, emoney]);
}

module.exports = { addToInvoice };