import express from "express";
import { pool } from "./config/database.js";

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());


const result = await pool.query(
  "SELECT NOW() AS current_time"
);

console.log(result.rows);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Jigyasu's Portfolio API",
    documentation: "/api/v1/health"
  });
});

// Health check API
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Portfolio backend is running!",
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} \n Link : http://localhost:${PORT}`);
});