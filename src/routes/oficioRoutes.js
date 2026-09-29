const express = require('express');
const router = express.Router();
const oficioController = require('../controllers/oficioController');

router.get('/', oficioController.getAll);
router.get('/:id', oficioController.getById);
router.post('/', oficioController.create);
router.put('/:id', oficioController.update);
router.delete('/:id', oficioController.delete);

module.exports = router;