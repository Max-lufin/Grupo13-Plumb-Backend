const OficioModel = require('../models/oficioModel');

exports.getAll = async (req, res) => {
  try {
    const oficios = await OficioModel.getAll();
    res.status(200).json({ data: oficios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const oficio = await OficioModel.getById(req.params.id);
    if (!oficio) return res.status(404).json({ error: 'No encontrado' });
    res.status(200).json({ data: oficio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    await OficioModel.create(req.body);
    res.status(201).json({ data: 'Creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    await OficioModel.update(req.params.id, req.body);
    res.status(200).json({ data: 'Actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await OficioModel.delete(req.params.id);
    res.status(200).json({ data: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};