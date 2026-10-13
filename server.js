const config = require('./src/config');
const createApp = require('./src/app');

createApp().listen(config.port, () => {
  console.log(`\n🎬 UGC Video Creator corriendo en http://localhost:${config.port}\n`);
});
