import { app } from "@/app";
import { env } from "@/config/env";

await app.listen({ port: env.PORT, host: "0.0.0.0" });

console.info("Aplicação rodando 🚀");
console.info(app.printRoutes());