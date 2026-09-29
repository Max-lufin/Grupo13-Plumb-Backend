const express = require('express');
const router = express.Router();
const solicitudController = require('../controllers/solicitudController');

router.get('/', solicitudController.getAll);
router.get('/:id', solicitudController.getById);
router.post('/', solicitudController.create);
router.put('/:id/estado', solicitudController.updateEstado);
router.delete('/:id', solicitudController.delete);

module.exports = router;