import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import resourceRoutes from "./routes/resources.js";
import documentRoutes from "./routes/documents.js";
import { notFound, errorHandler } from "./middleware/errors.js";

const app = express();
const defaultLocalOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const isLocalDevOrigin = (origin) => {
  try {
    const { protocol, hostname, port } = new URL(origin);
    if (!["http:", "https:"].includes(protocol)) return false;
    if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) return false;
    return /^517[3-9]$|^518\d$|^4173$/.test(port || "");
  } catch {
    return false;
  }
};
const allowedOrigins = [...new Set([
  ...defaultLocalOrigins,
  ...(process.env.CLIENT_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean)
])];

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && !allowedOrigins.includes(origin) && !isLocalDevOrigin(origin)) return res.status(403).json({ message: "Request origin is not allowed" });
  }
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "mau-rims-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api", resourceRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
