import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"] || req.headers["Authorization"];
  if (!token) return res.status(403).json({ error: "Acceso denegado." });

  try {
    const tokenBody = token.startsWith("Bearer ") ? token.slice(7) : token;
    const verified = jwt.verify(tokenBody, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
};

export const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permisos." });
    }
    next();
  };
};

// NUEVO: Para proteger el chat y las actualizaciones en tiempo real
export const verifySocketToken = (socket, next) => {
  // 1. Buscar en auth (estándar v4)
  let token = socket.handshake.auth?.token;

  // 2. Si no está, buscar en query params (común en móviles/v3)
  if (!token) {
    token = socket.handshake.query?.token;
  }

  // 3. Si no está, buscar en headers (estándar HTTP)
  if (!token && socket.handshake.headers?.authorization) {
    const parts = socket.handshake.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    console.log(`❌ Socket rechazado (${socket.id}): No se encontró token.`);
    return next(new Error("No autenticado"));
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = verified;
    next();
  } catch (err) {
    console.log(`❌ Socket rechazado (${socket.id}): Token inválido.`);
    next(new Error("Token inválido"));
  }
};
