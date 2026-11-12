import { postHandler } from "../lib/http.js";
import { checkout } from "../lib/handlers.js";

export const POST = postHandler(checkout);
