const MaestroModel = require('../models/maestroModel');

exports.getAll = async (req, res) => {
  try {
    const maestros = await MaestroModel.getAll();
    res.status(200).json({ data: maestros });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.buscar = async (req, res) => {
  try {
    const { region, especialidad, calificacion, disponibilidad } = req.query;
    if (!region || !especialidad) {
      return res.status(400).json({ error: 'region and especialidad are required' });
    }
    const maestros = await MaestroModel.buscar(region, especialidad, calificacion, disponibilidad);
    res.status(200).json({ data: maestros });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const maestro = await MaestroModel.getById(req.params.rut);
    if (!maestro) return res.status(404).json({ error: 'Maestro no encontrado' });
    res.status(200).json({ data: maestro });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    await MaestroModel.create(req.body);
    res.status(201).json({ data: 'Maestro creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    await MaestroModel.update(req.params.rut, req.body);
    res.status(200).json({ data: 'Maestro actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await MaestroModel.delete(req.params.rut);
    res.status(200).json({ data: 'Maestro eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};