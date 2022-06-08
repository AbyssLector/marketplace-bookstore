require('dotenv').config()

const jwt = require('jsonwebtoken');
const { Router } = require('express');
const { authenticateToken, authenticateHeader } = require('../middleware')
const db = require('../db');
const request = require('request');
const helper = require('../helper')

const router = Router();

router.get('/transaction', [authenticateHeader, authenticateToken], async (req, res) => {
    const query = await db.promise().query(`SELECT transaction_id, book_id, user_id, amount, emoney FROM transaction WHERE isAccepted IS NULL AND book_id IN (SELECT book_id FROM books WHERE user_id=${req.response.user_id})`);
    const seller_transaction_process = query[0];
    const query1 = await db.promise().query(`SELECT transaction_id, book_id, user_id, amount, emoney FROM transaction WHERE isAccepted=2 AND book_id IN (SELECT book_id FROM books WHERE user_id=${req.response.user_id})`);
    const seller_transaction_rejected = query1[0];
    const query2 = await db.promise().query(`SELECT transaction_id, book_id, user_id, amount, emoney FROM transaction WHERE NOT isAccepted=2 AND user_id=${req.response.user_id}`);
    const buyer_transaction_progress = query2[0];
    const query3 = await db.promise().query(`SELECT transaction_id, book_id, user_id, amount, emoney FROM transaction WHERE isAccepted=2 AND user_id=${req.response.user_id}`);
    const buyer_transaction_rejected = query3[0];
    const query4 = await db.promise().query(`SELECT transaction_id, book_id, user_id, amount, emoney FROM transaction WHERE isAccepted=1 AND book_id IN (SELECT book_id FROM books WHERE user_id=${req.response.user_id})`);
    const seller_transaction_finished = query4[0];
    const query5 = await db.promise().query(`SELECT transaction_id, book_id, user_id, amount, emoney FROM transaction WHERE isAccepted=2 AND user_id=${req.response.user_id}`);
    const buyer_transaction_finished = query5[0];
    return res.status(200).json({
        seller: {
            process: seller_transaction_process,
            finished: seller_transaction_finished,
            rejected: seller_transaction_rejected
        },
        buyer: {
            progress: buyer_transaction_progress,
            finished: buyer_transaction_finished,
            rejected: buyer_transaction_rejected
        }
    });
});

router.post('/transaction/:id/:acc', [authenticateHeader, authenticateToken], async (req, res) => {
    const transaction_id = req.params.id;
    const isAccept = req.params.acc;
    const { phone, emoney } = req.body
    const emoney_list = [
        "gallecoins",
        "padpay",
        "payfresh",
        "buskicoins",
        "kcnpay",
        "cuanind",
        "moneyz",
        "payphone",
        "ecoin",
        "talangin",
        "peacepay"
    ];
    if (!emoney_list.includes(emoney)) {
        return res.status(400).json({
            msg: "Emoney not registered"
        })
    }
    // console.log(transaction_id, req.response.user_id)
    const query = await db.promise().query(`SELECT * FROM transaction WHERE transaction_id=${transaction_id} AND book_id IN (SELECT book_id FROM books WHERE user_id=${req.response.user_id})`);
    const transaction = query[0][0];
    if (!transaction) {
        return res.status(400).json({
            msg: "No transaction found"
        });
    }
    if (transaction.isAccepted != null) {
        return res.status(400).json({
            msg: "Transaction already accepted"
        });
    }
    // If accepted
    // console.log(isAccept)
    if (isAccept == 1) {
        const login_data = {
            'method': 'POST',
            'url': 'https://gallecoins.herokuapp.com/api/users',
            'headers': {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "phone": "08666555444",
                "password": "diaralley"
            })
        };
        request(login_data, async function (error, response) {
            if (error) throw new Error(error);
            // console.log(response.body);
            db.execute(`UPDATE transaction SET isAccepted=1 WHERE transaction_id=${transaction_id}`, (err, result, fields) => {
                if (err) {
                    console.log(err);
                    return res.status(401).json('Server error');
                }
            });
            const result_call = JSON.parse(response.body);
            const token = result_call.token;
            // console.log(token)
            const query3 = await db.promise().query(`SELECT * FROM users WHERE user_id=(SELECT user_id FROM transaction WHERE transaction_id=${transaction_id})`);
            const seller = query3[0][0];
            // console.log(seller);
            if (emoney == "gallecoins") {
                const transfer_data = {
                    'method': 'POST',
                    'url': 'https://gallecoins.herokuapp.com/api/transfer',
                    'headers': {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        "amount": transaction.amount,
                        "description": "Accept Transfer " + transaction.transaction_id,
                        "phone": phone
                    })
                }
                request(transfer_data, function (error, response) {
                    if (error) throw new Error(error);
                    if (response.statusCode != 200) {
                        return res.status(400).json({
                            msg: "Transaction failed",
                            err: response.body
                        });
                    }
                    helper.addToInvoice(transaction_id, emoney);
                    return res.status(200).json({ msg: "Transaction accepted" });
                });
            } else {
                const transfer_data = {
                    'method': 'POST',
                    'url': 'https://gallecoins.herokuapp.com/api/transfer/' + emoney,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        "amount": transaction.amount,
                        "description": "Transaction from Diaralley id: " + transaction.transaction_id,
                        "phone_target": phone
                    })
                };
                // console.log(transfer_data)
                request(transfer_data, function (error, response) {
                    if (error) throw new Error(error);
                    if (response.statusCode != 200) {
                        return res.status(400).json({
                            msg: "Transaction failed",
                            err: response.body
                        });
                    }
                    helper.addToInvoice(transaction_id, emoney);
                    return res.status(200).json({ msg: "Transaction accepted" });
                });
            }
        });
    } else {
        db.execute(`UPDATE transaction SET isAccepted=2 WHERE transaction_id=${transaction_id}`, (err, result, fields) => {
            if (err) {
                console.log(err);
                return res.status(401).json('Server error');
            }
            return res.status(200).json({ msg: "Transaction rejected!" });
        });
    }

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