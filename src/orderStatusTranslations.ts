export const getOrderStatusLabel = (status: string): string => {
  const translations: { [key: string]: string } = {
    PENDING: "Pendiente",
    PREPARING: "Preparando",
    READY: "Listo",
    ON_WAY: "En camino",
    DELIVERED: "Entregado",
    REJECTED: "Rechazado",
  };
  return translations[status] || status;
};

export const getOrderStatusColor = (
  status: string,
): "yellow" | "blue" | "green" | "red" => {
  switch (status) {
    case "PENDING":
      return "yellow";
    case "PREPARING":
    case "READY":
      return "blue";
    case "ON_WAY":
      return "blue";
    case "DELIVERED":
      return "green";
    case "REJECTED":
      return "red";
    default:
      return "blue";
  }
};
