require('dotenv').config()
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (token == null) return res.status(401).json("Bearer token not found");

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, response) => {
        if (err) return res.status(403).json("Invalid Token");
        req.response = response;
        next();
    })
}
function authenticateTokenApi(req, res, next) {
    const { token } = req.body;

    if (token == null) return res.status(401).json("Bearer token not found");

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, response) => {
        if (err) return res.status(403).json("Invalid Token");
        req.response = response;
        next();
    })
}

function authenticateHeader(req, res, next) {
    const header = req.get("Content-Type");
    if (header !== "application/json")
        return res.status(401).json("Invalid header type. Must include application/json");
    next();
}

function checkAdmin(req, res, next) {
    if (req.response.role != "admin") {
        return res.status(403).json("Forbidden");
    }
    next();
}

module.exports = { authenticateToken, authenticateHeader, checkAdmin, authenticateTokenApi };