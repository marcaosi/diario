// Servidor para rodar no seu computador: npm run dev
const path = require('path');
const express = require('express');
const api = require('./lib/app');

const server = express();
server.use(api);
server.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Diário rodando em http://localhost:${PORT}`);
  console.log('Dados salvos em ./db.json');
  if (!process.env.ADMIN_PASSWORD) {
    console.log('Aviso: usando a senha padrão (admin123). Defina ADMIN_PASSWORD antes de publicar.');
  }
});
