import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.port, () => {
  console.log(`API da Casa de Leilões rodando em http://localhost:${config.port}`);
});
