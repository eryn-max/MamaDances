import { postHandler } from "../lib/http.js";
import { upsell } from "../lib/handlers.js";

export const POST = postHandler((body) => upsell(body));
