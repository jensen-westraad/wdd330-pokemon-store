import { defineConfig } from "vite";

// Build every page, so they all exist on the live site too.
export default defineConfig({
    build: {
        rolldownOptions: {
            input: {
                main: "index.html",
                cart: "cart.html",
                binder: "binder.html",
            },
        },
    },
});