require('dotenv').config()

const express = require('express');
const user_routes = require('./routes/users');
const register_routes = require('./routes/register');
const books_routes = require('./routes/books');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/users', user_routes);
app.use('/api/books', books_routes);
app.use('/api/register', register_routes);

app.get('/api/emoney', (req, res) => {
    return res.status(200).json({
        msg: "registered emoney",
        list: [
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
        ]
    });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Listening on port ${port}...`));