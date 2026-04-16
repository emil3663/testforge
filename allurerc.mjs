import { defineConfig } from "allure";

export default defineConfig({
    plugins: {
        awesome: {
            options: {
                reportLanguage: "en",
                singleFile: true,
            },
        },
    },
});