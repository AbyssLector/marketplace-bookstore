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
router.get('/:id', async (req, res) => {
    const id = req.params.id
    const query_res = await db.promise().query(`SELECT * FROM books WHERE book_id=${id}`);
    const books = query_res[0][0];
    return res.status(200).json({
        books
    })
});
router.post('/update/:id', [authenticateHeader, authenticateToken], async (req, res) => {
    const id = req.params.id;
    const { title, author, description, price, image, publisher, year, casing, condition, edition, stock, cover } = req.body;
    const query_res = await db.promise().query(`SELECT * FROM books WHERE book_id=${id}`);
    const book = query_res[0][0];
    if (req.response.user_id != book.user_id) {
        return res.status(400).json({
            msg: "Not allowed to edit this book"
        });
    }
    const new_book = {
        title: (title ? title : book.title),
        author: (author ? author : book.author),
        description: (description ? description : book.description),
        price: (price ? price : book.price),
        edition: (edition ? edition : book.edition),
        book_case: (casing ? casing : book.book_case),
        year_of_publication: (year ? year : book.year_of_publication),
        book_condition: (condition ? condition : book.book_condition),
        stock: (stock ? stock : book.stock),
        publisher: (publisher ? publisher : book.publisher),
        cover: (cover ? cover : book.cover)
    }

    db.execute(`UPDATE books SET title=?, author=?, description=?, price=?, edition=?, book_case=?, year_of_publication=?, book_condition=?, stock=?, publisher=?, cover=? WHERE book_id=?`, [new_book.title, new_book.author, new_book.description, new_book.price, new_book.edition, new_book.book_case, new_book.year_of_publication, new_book.book_condition, new_book.stock, new_book.publisher, new_book.cover, id], (err, results, fields) => {
        if (err) {
            console.log(err);
            return res.status(500).json("Server error");
        }
        return res.status(200).json({
            msg: "Book has been updated",
            books: new_book
        });
    });
});
router.post('/add', [authenticateHeader, authenticateToken], async (req, res) => {
    const { title, author, description, price, image, publisher, year, casing, condition, edition, stock } = req.body;
    // if(!title | !)
    const cover = (image ? image : 'default.png');
    db.execute(`INSERT INTO books (title, author, description, price, user_id, edition, book_case, year_of_publication, book_condition, stock, publisher, cover) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, author, description, price, req.response.user_id, edition, casing, year, condition, stock, publisher, cover], (err, results, fields) => {
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
    let { amount, emoney, username, password } = req.body;
    if (!amount) {
        amount = 1;
    }
    if (amount <= 0) {
        return res.status(400).json({ msg: "Invalid amount" });
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
    if ((book.stock - amount) < 0) {
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
        var options = {
            'method': 'POST',
            'url': 'https://gallecoins.herokuapp.com/api/users',
            'headers': {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "username": username,
                "password": password
            })
        };
        request(options, function (error, response) {
            if (error) throw new Error(error);
            if (response.statusCode != 200) {
                return res.status(400).json({
                    msg: "Checkout failed: ",
                    err: response.body
                });
            }
            const login_result = JSON.parse(response.body);
            const token = login_result.token;
            const transfer_data = {
                'method': 'POST',
                'url': 'https://gallecoins.herokuapp.com/api/transfer',
                'headers': {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    "amount": total_price,
                    "description": "Buy product " + book.title,
                    "phone": "08666555444"
                })
            };

            request(transfer_data, function (error, response) {
                if (error) throw new Error(error);
                if (response.statusCode != 200) {
                    return res.status(400).json({
                        msg: "Payment failed: ",
                        err: JSON.parse(response.body)
                    });
                }

                db.execute("UPDATE books SET stock=stock-? WHERE book_id=?;", [amount, book.book_id], (err, result, fields) => {
                    if (err) {
                        return res.status(500).json("Server Error");
                    }
                });

                db.execute("INSERT INTO transaction (book_id, user_id, amount, emoney, username, password) VALUES (?,?,?,?,?,?);", [book_id, book.user_id, total_price, emoney, username, password], (err, result, fields) => {
                    if (err) {
                        // console.log(err)
                        return res.status(500).json("Server Error");
                    }
                    return res.status(200).json({
                        msg: "Checkout success. Waiting seller to proceed"
                    });
                });
            });
        });
    } else if (emoney == "cuanind") {
        var login_data = {
            'method': 'POST',
            'url': 'https://e-money-kelompok5.herokuapp.com/cuanind/user/login',
            'headers': {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "notelp": username,
                "password": password
            })
        };
        request(login_data, function (error, response) {
            if (error) return res.status(500).json(error);
            const result_call = response.body;
            const token = result_call;
            if (token == null || response.statusCode != 200)
                return res.status(400).json("Invalid token");
            // console.log(token);
            // Transfer
            var transfer_data = {
                'method': 'POST',
                'url': 'https://e-money-kelompok5.herokuapp.com/cuanind/transfer/gallecoins',
                'headers': {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    "amount": total_price,
                    "target": "08666555444"
                })

            };
            request(transfer_data, function (error, response) {
                if (error) return res.status(500).json(error);
                const result_call = response.body
                // const result_call = JSON.parse(response.body)
                // console.log(result_call)
                if (response.statusCode != 200)
                    return res.status(400).json({
                        msg: "Payment failed: ",
                        err: response.body
                    });

                db.execute("UPDATE books SET stock=stock-? WHERE book_id=?;", [amount, book.book_id], (err, result, fields) => {
                    if (err) {
                        return res.status(500).json("Server Error");
                    }
                });

                db.execute("INSERT INTO transaction (book_id, user_id, amount, emoney, username, password) VALUES (?,?,?,?,?,?);", [book_id, book.user_id, total_price, emoney, username, password], (err, result, fields) => {
                    if (err) {
                        // console.log(err)
                        return res.status(500).json("Server Error");
                    }
                    return res.status(200).json({
                        msg: "Checkout success. Waiting seller to proceed"
                    });
                });
            });
        });
    } else if (emoney == "payfresh") {

    }
});


module.exports = router;