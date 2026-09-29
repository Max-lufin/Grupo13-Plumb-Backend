const ClienteModel = require('../models/clienteModel');

exports.getAll = async (req, res) => {
  try {
    const clientes = await ClienteModel.getAll();
    res.status(200).json({ data: clientes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const cliente = await ClienteModel.getById(req.params.rut);
    if (!cliente) return res.status(404).json({ error: 'No encontrado' });
    res.status(200).json({ data: cliente });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    await ClienteModel.create(req.body);
    res.status(201).json({ data: 'Creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    await ClienteModel.update(req.params.rut, req.body);
    res.status(200).json({ data: 'Actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await ClienteModel.delete(req.params.rut);
    res.status(200).json({ data: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};