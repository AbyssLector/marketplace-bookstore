require('dotenv').config()

const jwt = require('jsonwebtoken');
const { Router } = require('express');
const { authenticateToken, authenticateHeader } = require('../middleware')
const db = require('../db');

const router = Router();

router.get('/transaction', [authenticateHeader, authenticateToken], async (req, res) => {
    const query = await db.promise().query(`SELECT * FROM transaction WHERE book_id=(SELECT book_id FROM books WHERE user_id=${req.response.user_id})`);
    const seller_transaction = query[0];
    const query2 = await db.promise().query(`SELECT * FROM transaction WHERE user_id=${req.response.user_id}`);
    const buyer_transaction = query2[0];
    return res.status(200).json({
        seller: seller_transaction,
        buyer: buyer_transaction
    });
});

router.post('/transaction/:id/:acc', [authenticateHeader, authenticateToken], async (req, res) => {
    const transaction_id = req.params.id;
    const isAccept = req.params.acc;
    const query = await db.promise().query(`SELECT * FROM transaction WHERE transaction_id=${transaction_id} AND book_id=(SELECT book_id FROM book WHERE user_id=${req.response.user_id})`);
    const transaction = query[0][0];
    if (!transaction) {
        return res.status(400).json({
            msg: "No transaction found"
        });
    }
    // If accepted
    if (isAccept) {
        db.execute(`UPDATE transaction SET isAccepted=1 WHERE transaction_id=${transaction_id}`, (err, result, fields) => {
            if (err) {
                console.log(err);
                return res.status(401).json('Server error');
            }
        });
        return res.status(200).json({ msg: "Transaction accepted" });
    }
    db.execute(`UPDATE transaction SET isAccepted=2 WHERE transaction_id=${transaction_id}`, (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.status(401).json('Server error');
        }
    });

    return res.status(200).json({ msg: "Transaction rejected!" });

});

// Login
router.post('/', authenticateHeader, async (req, res) => {
    const { email, password } = req.body;
    db.query(`SELECT * FROM users WHERE email=? LIMIT 1`, [email], (err, result, fields) => {
        result = result[0];

        if (err) {
            console.log(err);
            return res.status(401).json('Server error');
        }
        if (!result || result.password !== password)
            return res.status(401).json('Invalid email or password');

        const token = jwt.sign({
            user_id: result.user_id,
            username: result.username,
            phone: result.phone,
            email: result.email,
            name: result.name
        }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
        res.status(200).json({
            msg: 'login success!',
            token: token
        });
    });
});
module.exports = router;