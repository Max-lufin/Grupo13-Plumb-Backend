const CalificacionModel = require('../models/calificacionModel');

exports.getAll = async (req, res) => {
  try {
    const calificaciones = await CalificacionModel.getAll();
    res.status(200).json({ data: calificaciones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const calificacion = await CalificacionModel.getById(req.params.id);
    if (!calificacion) return res.status(404).json({ error: 'No encontrado' });
    res.status(200).json({ data: calificacion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    await CalificacionModel.create(req.body);
    res.status(201).json({ data: 'Creada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    await CalificacionModel.update(req.params.id, req.body);
    res.status(200).json({ data: 'Actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await CalificacionModel.delete(req.params.id);
    res.status(200).json({ data: 'Eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};