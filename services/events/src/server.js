// Punto de entrada: conserva `node src/server.js` y el puerto 8002.
import { app } from './app.js';
import { sql } from './db/connection.js';
import { seed } from './services/seed.js';

await sql.authenticate();

await sql.sync();

await seed();

app.listen(8002, () => {
    console.log('Eventos http://localhost:8002');
});
