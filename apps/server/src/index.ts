import { createServer } from "node:http";

import { app } from "./app.js";
import { config } from "./config/env.js";
import { initSocket } from "./socket/index.js";

const server = createServer(app);
const io = initSocket(server);

server.listen(config.port, () => {
  console.log(
    `[server] running on http://localhost:${config.port} (${config.nodeEnv})`
  );
});

export { io, server };
