const SolicitudModel = require('../models/solicitudModel');

exports.getAll = async (req, res) => {
  try {
    const solicitudes = await SolicitudModel.getAll();
    res.status(200).json({ data: solicitudes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const solicitud = await SolicitudModel.getById(req.params.id);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.status(200).json({ data: solicitud });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    await SolicitudModel.create(req.body);
    res.status(201).json({ data: 'Solicitud creada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEstado = async (req, res) => {
  try {
    if (!req.body.estado) return res.status(400).json({ error: 'estado es requerido' });
    await SolicitudModel.updateEstado(req.params.id, req.body.estado);
    res.status(200).json({ data: 'Estado de solicitud actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await SolicitudModel.delete(req.params.id);
    res.status(200).json({ data: 'Solicitud eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};