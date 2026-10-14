import { defineConfig } from "vite";

// Build both pages, so cart.html exists on the live site too.
export default defineConfig({
    build: {
        rolldownOptions: {
            input: {
                main: "index.html",
                cart: "cart.html",
            },
        },
    },
});