import React from 'react';

// Buttons
export const Button = ({ onClick, children, variant = 'primary', className = '', type = 'button', disabled = false }: any) => {
  const baseStyle = "px-4 py-3 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-white shadow-lg shadow-red-500/20 hover:bg-red-600",
    secondary: "bg-white text-iosText border border-gray-200 hover:bg-gray-50",
    danger: "bg-red-100 text-red-600 hover:bg-red-200",
    ghost: "bg-transparent text-iosGray hover:text-iosText"
  };
  
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

// Inputs
export const Input = ({ label, error, ...props }: any) => (
  <div className="mb-4 w-full">
    {label && <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">{label}</label>}
    <input 
      {...props}
      className={`w-full px-4 py-3 rounded-2xl bg-gray-100 border-2 border-transparent focus:bg-white focus:border-primary focus:outline-none transition-colors text-iosText placeholder-gray-400 ${error ? 'border-red-500 bg-red-50' : ''}`}
    />
    {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
  </div>
);

// Card
export const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-3xl p-5 shadow-ios-card ${className}`}>
    {children}
  </div>
);

// Badge
export const Badge = ({ children, color = 'gray' }: any) => {
  const colors = {
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-600'
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${colors[color as keyof typeof colors]}`}>
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
          <button onClick={onClose} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
