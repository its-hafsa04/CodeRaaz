const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const apiRouter = require("./routes/api");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

// API Routes
app.use("/api", apiRouter);

// Root Endpoint Health Check
app.get("/health", (req, res) => {
  return res
    .status(200)
    .json({ status: "ok", timestamp: new Date().toISOString() });
});

// Fallback Page Not Found Handler
app.use(notFound);

// Global Error Handler (logs root cause and returns structured error)
app.use(errorHandler);

module.exports = app;
