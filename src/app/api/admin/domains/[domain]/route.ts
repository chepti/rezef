import { z } from "zod";
import { deleteDomain, normalizeDomain, updateDomain } from "@/lib/admin";
import { readJson, withAdmin } from "@/lib/http";
import { HttpError } from "@/lib/session";

const schema = z.object({ region: z.string().max(60).nullable().optional(), note: z.string().max(120).nullable().optional() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/domains/[domain]">) {
  const { domain } = await ctx.params;
  return withAdmin(async () => {
    const d = normalizeDomain(decodeURIComponent(domain));
    if (!d) throw new HttpError(400, "דומיין לא תקין");
    await updateDomain(d, await readJson(req, schema));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/domains/[domain]">) {
  const { domain } = await ctx.params;
  return withAdmin(async () => {
    const d = normalizeDomain(decodeURIComponent(domain));
    if (!d) throw new HttpError(400, "דומיין לא תקין");
    await deleteDomain(d);
  });
}
