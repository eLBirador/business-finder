import { d1Repo, handleDisable, handleRead, handleUpdate } from "../../../src/store";
import type { Env } from "../../../src/tiles";
const noDb = () => Response.json({ error: "storage not configured" }, { status: 503 });
const id = (p: string | string[]) => String(Array.isArray(p) ? p[0] : p);
/** GET (public, display-safe), PUT (Bearer edit token), DELETE (disable, Bearer edit token). */
export const onRequestGet: PagesFunction<Env, "id"> = ({ env, params }) => (env.DB ? handleRead(id(params.id), d1Repo(env.DB)) : noDb());
export const onRequestPut: PagesFunction<Env, "id"> = ({ request, env, params }) => (env.DB ? handleUpdate(request, id(params.id), d1Repo(env.DB)) : noDb());
export const onRequestDelete: PagesFunction<Env, "id"> = ({ request, env, params }) => (env.DB ? handleDisable(request, id(params.id), d1Repo(env.DB)) : noDb());
