import React from "react";

export const NavBtn = ({ icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center p-2 transition-colors ${
      active ? "text-primary" : "text-gray-400"
    }`}
  >
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium mt-1">{label}</span>
  </button>
);
