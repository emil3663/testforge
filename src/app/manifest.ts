import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: SITE_NAME,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: "/",
        display: "standalone",
        background_color: "#fafafa",
        theme_color: "#4f46e5",
        icons: [
            {
                src: "/globe.svg",
                sizes: "any",
                type: "image/svg+xml",
            },
        ],
        id: getSiteUrl(),
    };
}