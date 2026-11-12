import { postHandler } from "../lib/http.js";
import { apply } from "../lib/handlers.js";

export const POST = postHandler((body, request) => apply(body, fetch, request));
