const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

router.get('/', clienteController.getAll);
router.get('/:rut', clienteController.getById);
router.post('/', clienteController.create);
router.put('/:rut', clienteController.update);
router.delete('/:rut', clienteController.delete);

module.exports = router;