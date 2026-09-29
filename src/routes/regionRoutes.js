const express = require('express');
const router = express.Router();
const regionController = require('../controllers/regionController');

router.get('/', regionController.getAll);
router.get('/:id', regionController.getById);
router.post('/', regionController.create);
router.put('/:id', regionController.update);
router.delete('/:id', regionController.delete);

module.exports = router;