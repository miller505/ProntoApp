export const formatDate = (timestamp: number | string | Date) => {
  const date = new Date(timestamp);
  return date
    .toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()
    .replace(/\./g, "");
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371; // Radio de la tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getOrderStatusColor = (
  status: string,
): "yellow" | "blue" | "green" | "red" => {
  switch (status.toUpperCase()) {
    case "PENDIENTE":
      return "yellow";
    case "PREPARANDO":
    case "LISTO PARA RECOGER":
    case "EN CAMINO":
    case "LLEGÓ AL DOMICILIO":
      return "blue";
    case "ENTREGADO":
      return "green";
    case "RECHAZADO":
    case "CANCELADO":
      return "red";
    default:
      return "blue";
  }
};

// Fisher-Yates shuffle algorithm
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
