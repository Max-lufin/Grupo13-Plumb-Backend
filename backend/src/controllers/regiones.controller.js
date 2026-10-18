import { Region } from '../models/region.model.js';
import { ok } from '../utils/http.js';

export async function listar(req, res) {
  res.json(ok(await Region.listar()));
}
