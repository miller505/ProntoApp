import React, { forwardRef, useState, useRef, useEffect } from "react";
import { Icons } from "../constants";

// Buttons
export const Button = ({
  onClick,
  children,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
}: any) => {
  const baseStyle =
    "px-4 py-3 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-primary text-white shadow-lg shadow-red-500/20 hover:bg-red-600",
    secondary: "bg-white text-iosText border border-gray-200 hover:bg-gray-50",
    danger: "bg-red-100 text-red-600 hover:bg-red-200",
    ghost: "bg-transparent text-iosGray hover:text-iosText",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {children}
    </button>
  );
};

// CORRECCIÓN: Uso de forwardRef para permitir referencias en el DOM
export const Input = forwardRef<HTMLInputElement, any>(
  (
    {
      label,
      error,
      as = "input",
      className = "",
      wrapperClassName = "",
      ...props
    },
    ref,
  ) => {
    const Component = as;
    return (
      <div className={`mb-4 w-full ${wrapperClassName}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">
            {label}
          </label>
        )}
        <Component
          ref={ref}
          {...props}
          className={`w-full px-4 py-3 rounded-2xl bg-gray-100 border-2 border-transparent focus:bg-white focus:border-primary focus:outline-none transition-colors text-iosText placeholder-gray-400 ${
            error ? "border-red-500 bg-red-50" : ""
          } ${as === "textarea" ? "resize-none" : ""} ${className}`}
        />
        {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

// Card
export const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-3xl p-5 shadow-ios-card ${className}`}>
    {children}
  </div>
);

// Badge
export const Badge = ({ children, color = "gray", className = "" }: any) => {
  const colors = {
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    blue: "bg-blue-100 text-blue-600",
    yellow: "bg-yellow-100 text-yellow-600",
    gray: "bg-gray-100 text-gray-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <span
      className={`px-2 py-1 rounded-lg text-xs font-bold ${colors[color as keyof typeof colors]} ${className}`}
    >
      {children}
    </span>
  );
};

// Modal
export const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-lg text-iosText">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar modal" // CORRECCIÓN: Accesibilidad
            className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// Searchable Select (Combobox)
export const SearchableSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder,
}: any) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((o: any) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedOption = options.find((o: any) => o.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mb-4 relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">
          {label}
        </label>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-2xl bg-gray-100 border-2 border-transparent cursor-pointer flex justify-between items-center hover:bg-gray-200 transition-colors"
      >
        <span
          className={
            selectedOption ? "text-iosText font-medium" : "text-gray-400"
          }
        >
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <Icons.ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-down">
          <div className="p-2 border-b border-gray-50 bg-gray-50/50">
            <div className="relative">
              <Icons.Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                autoFocus
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-white rounded-xl text-sm focus:outline-none border border-gray-100"
                placeholder="Buscar colonia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((o: any) => (
                <div
                  key={o.id}
                  className={`px-4 py-3 text-sm cursor-pointer hover:bg-primary/5 transition-colors border-b border-gray-50 last:border-0 ${o.id === value ? "bg-primary/10 text-primary font-bold" : "text-gray-700"}`}
                  onClick={() => {
                    onChange(o.id);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {o.name}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-400 text-xs italic">
                No se encontraron colonias
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
