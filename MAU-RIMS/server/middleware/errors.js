export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "MulterError") {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: error.code === "LIMIT_FILE_SIZE" ? "File exceeds the 10 MB limit" : error.message });
  }
  if (error.status && error.status >= 400 && error.status < 500) return res.status(error.status).json({ message: error.message });
  if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
  if (error.code === 11000) return res.status(409).json({ message: "A record with that unique value already exists" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid record identifier" });
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
}
