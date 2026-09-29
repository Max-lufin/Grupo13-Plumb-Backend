const express = require('express');
const router = express.Router();
const maestroController = require('../controllers/maestroController');

router.get('/buscar', maestroController.buscar);
router.get('/', maestroController.getAll);
router.get('/:rut', maestroController.getById);
router.post('/', maestroController.create);
router.put('/:rut', maestroController.update);
router.delete('/:rut', maestroController.delete);

module.exports = router;