import cors from "cors";
import express from "express";
import { booksRouter } from "./routes/books.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "my-book-club-api",
      endpoints: ["/health", "/api/books", "/api/books/:id"],
    });
  });

  app.use("/api/books", booksRouter);

  return app;
}
