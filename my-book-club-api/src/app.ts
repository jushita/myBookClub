import cors from "cors";
import express from "express";
import type { Express } from "express";
import { authRouter } from "./routes/auth.js";
import { booksRouter } from "./routes/books.js";
import { clubsRouter } from "./routes/clubs.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "my-book-club-api",
      endpoints: [
        "/health",
        "/api/auth/signup",
        "/api/auth/login",
        "/api/auth/social",
        "/api/books",
        "/api/books/:id",
        "/api/clubs",
        "/api/clubs/:id",
        "/api/clubs/:id/members",
        "/api/clubs/:id/books",
      ],
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/clubs", clubsRouter);

  return app;
}
