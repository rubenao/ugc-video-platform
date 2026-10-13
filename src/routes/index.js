const { Router } = require('express');

const factories = [
  require('./voices'),
  require('./uploads'),
  require('./avatar'),
  require('./audio'),
  require('./video'),
  require('./social'),
  require('./apimart'),
  require('./dubbing'),
  require('./download')
];

// Monta todas las rutas bajo /api. Para añadir un módulo basta con registrarlo arriba.
module.exports = (services) => {
  const api = Router();
  factories.forEach(createRouter => api.use(createRouter(services)));
  return api;
};
