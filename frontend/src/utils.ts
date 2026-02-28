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
