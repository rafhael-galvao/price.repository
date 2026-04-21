import { startApp } from "@/app";

startApp().catch((error) => {
    console.error(error);
    process.exit(1);
});
