require('dotenv').config()

const jwt = require('jsonwebtoken');
const { Router } = require('express');
const { authenticateToken, authenticateHeader } = require('../middleware')
const db = require('../db');
const request = require('request');

const router = Router();
router.get('/', async (req, res) => {
    const query_res = await db.promise().query("SELECT * FROM books");
    const books = query_res[0];
    return res.status(200).json({
        books
    })
});

router.post('/add', [authenticateHeader, authenticateToken], async (req, res) => {
    const { title, author, description, price, image, publisher, year, casing, condition, edition, stock } = req.body;
    const cover = (image ? image : 'default.png');

    db.execute(`INSERT INTO books (title, author, description, price, user_id, edition, book_case, year_of_publication, book_condition, stock, publisher, cover) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, author, description, price, req.response.id, edition, casing, year, condition, stock, publisher, cover], (err, results, fields) => {
            if (err) {
                console.log(err);
                return res.status(500).json("Server error");
            }
            res.status(200).json({
                msg: "Book has been registered!"
            });
        });
});

router.post('/search', async (req, res) => {
    const { title, author, publisher } = req.body;
    if (!(title || author || publisher)) {
        return res.status(400).json({
            msg: "Must include keyword"
        });
    }
    let result = [];
    if (title) {
        const query = await db.promise().query(`SELECT * FROM books WHERE title LIKE '%${title}%'`);
        result.push(query[0]);
    }
    if (author) {
        const query = await db.promise().query(`SELECT * FROM books WHERE author LIKE '%${author}%'`);
        result.push(query[0]);
    }
    if (publisher) {
        const query = await db.promise().query(`SELECT * FROM books WHERE publisher LIKE '%${publisher}%'`);
        result.push(query[0]);
    }

    return res.status(200).json({ result });
});
router.post('/checkout/:id', [authenticateHeader, authenticateToken], async (req, res) => {
    const book_id = req.params.id;
    let { amount, emoney, jwt } = req.body;
    if (!amount) {
        amount = 1;
    }
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

    const query_result1 = await db.promise().query("SELECT * FROM books WHERE book_id=?", [book_id]);
    const book = query_result1[0][0];
    if (!book) {
        return res.status(400).json({
            msg: "Book id not found"
        });
    }
    if ((book.stock - amount) <= 0) {
        return res.status(400).json({
            msg: "Book out of stock"
        });
    }
    const query_result2 = await db.promise().query("SELECT * FROM users WHERE user_id=(SELECT user_id FROM books WHERE book_id=?)", [book_id]);
    const seller = query_result2[0][0];

    const total_price = book.price * amount;
    // Gallecoins
    // console.log(jwt);
    if (emoney == "gallecoins") {
        const transfer_data = {
            'method': 'POST',
            'url': 'https://gallecoins.herokuapp.com/api/transfer',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt
            },
            body: JSON.stringify({
                "amount": total_price,
                "description": "Buy product " + book.title,
                "phone": "08666555444"
            })
        };
        // console.log(transfer_data);
        request(transfer_data, function (error, response) {
            if (error) throw new Error(error);
            // console.log(response.body);
            if (response.statusCode != 200) {
                return res.status(400).json({
                    msg: "Payment failed: ",
                    err: JSON.parse(response.body)
                });
            }
            // console.log(amount, book, book_id, total_price);
            // db.execute("UPDATE books SET stock=stock-? WHERE book_id=?;", [amount, book.book_id], (err, result, fields) => {
            //     if (err) {
            //         return res.status(500).json("Server Error");
            //     }
            // });
            // console.log(book_id, book.user_id, total_price);
            db.execute("INSERT INTO transaction (book_id, user_id, amount, emoney) VALUES (?,?,?,?);", [book_id, book.user_id, total_price, emoney], (err, result, fields) => {
                if (err) {
                    return res.status(500).json("Server Error");
                }
            });
            return res.status(200).json({
                msg: "Checkout success. Waiting seller to proceed"
            });
        });
    }
});


module.exports = router;