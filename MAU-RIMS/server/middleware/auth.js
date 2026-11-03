import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.token || req.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Authentication required" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("+authVersion");
    if (!user || !user.isActive || payload.ver !== user.authVersion) return res.status(401).json({ message: "Account is unavailable" });
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired authentication token" });
    }
    next(error);
  }
}

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
  next();
};
