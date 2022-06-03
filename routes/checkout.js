const { Router } = require('express');
const { append } = require('express/lib/response');
const db = require('../db');
const { authenticateToken, authenticateHeader } = require('../middleware')
const router = Router();


module.exports = router;