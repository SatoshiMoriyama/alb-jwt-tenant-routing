import { Hono } from "hono";
import { handle } from "hono/aws-lambda";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    message: "Hello from Hono on Lambda!",
    tenantId: process.env.TENANT_ID || "not set",
  });
});

export const handler = handle(app);
