import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  // CORRECCIÓN: Sensibilidad a mayúsculas/minúsculas en Node y seguridad de objeto
  const token = req.headers["authorization"] || req.headers["Authorization"];

  if (!token) {
    return res.status(403).json({ error: "Acceso denegado. No hay token." });
  }

  try {
    const tokenBody = token.startsWith("Bearer ") ? token.slice(7) : token;
    const verified = jwt.verify(tokenBody, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    // CORRECCIÓN: Distinguir expiración de malformación para el frontend
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token expirado. Por favor, inicia sesión de nuevo." });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
};

export const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };
};
