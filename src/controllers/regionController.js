const RegionModel = require('../models/regionModel');

exports.getAll = async (req, res) => {
  try {
    const regiones = await RegionModel.getAll();
    res.status(200).json({ data: regiones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const region = await RegionModel.getById(req.params.id);
    if (!region) return res.status(404).json({ error: 'No encontrado' });
    res.status(200).json({ data: region });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    await RegionModel.create(req.body);
    res.status(201).json({ data: 'Creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    await RegionModel.update(req.params.id, req.body);
    res.status(200).json({ data: 'Actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await RegionModel.delete(req.params.id);
    res.status(200).json({ data: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};