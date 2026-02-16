import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastify = Fastify({ logger: true });
// Register WebSocket plugin first
await fastify.register(fastifyWebSocket);
// WebSocket route for real-time updates
fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        connection.socket.send('Connected to Camelot');
        connection.socket.on('message', (message) => {
            // Handle incoming WebSocket messages
            console.log('Received message:', message.toString());
            connection.socket.send(`Echo: ${message}`);
        });
    });
});
// API routes
fastify.get('/api/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
fastify.get('/api/tickets', async (request, reply) => {
    // TODO: Return tickets from database
    return { tickets: [] };
});
fastify.post('/api/tickets', async (request, reply) => {
    // TODO: Create new ticket
    reply.code(201);
    return { message: 'Ticket created' };
});
// Register static file serving
await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
});
const start = async () => {
    try {
        await fastify.listen({ port: 1187, host: '0.0.0.0' });
        console.log('🏰 Camelot server running on http://localhost:1187');
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map