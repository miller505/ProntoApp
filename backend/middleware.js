import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ error: "Acceso denegado. No hay token." });
  }

  try {
    // El formato suele ser "Bearer <token>", así que quitamos el prefijo si existe
    const tokenBody = token.startsWith("Bearer ") ? token.slice(7) : token;
    const verified = jwt.verify(tokenBody, process.env.JWT_SECRET);
    req.user = verified; // Guardamos los datos del usuario en la petición
    next(); // Continuamos a la ruta
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
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
