import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext"; // <-- Importamos AuthContext
import { UserRole, Colony, SubscriptionType, User } from "../types";
import { Button, Input, Card } from "../components/UI";
import { Icons, ALLOWED_EMAILS } from "../constants";
import { uploadToCloudinary } from "../api"; // Importar utilidad
import { useGoogleLogin } from "@react-oauth/google";

export const Register = ({ onBack }: { onBack: () => void }) => {
  const { colonies } = useApp();
  const { register, googleLogin } = useAuth(); // <-- register ahora viene de useAuth

  const [role, setRole] = useState<UserRole>(UserRole.CLIENT);
  const [formData, setFormData] = useState<any>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    ineImage: "",
    // Store specific
    storeName: "",
    storeStreet: "",
    storeNumber: "",
    storeColonyId: "",
    subscription: SubscriptionType.STANDARD,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    // Constraints
    if (name === "firstName" || name === "lastName" || name === "storeName") {
      // No symbols or numbers for names (simplified regex)
      if (/[^a-zA-Z\s]/.test(value)) return;
      if (value.length > 30) return;
    }

    if (name === "phone") {
      if (/[^0-9]/.test(value)) return;
      if (value.length > 10) return;
    }

    if (name === "storeNumber") {
      if (/[^0-9]/.test(value)) return;
      if (value.length > 5) return;
    }

    if (name === "storeStreet") {
      if (/[^a-zA-Z0-9\s]/.test(value)) return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const url = await uploadToCloudinary(e.target.files[0]);
        setFormData({ ...formData, ineImage: url });
      } catch (error) {
        alert("Error al subir imagen. Intenta de nuevo.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleGoogleRegister = useGoogleLogin({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    onSuccess: async (tokenResponse) => {
      // Pasamos el rol seleccionado para que el backend sepa cómo crear el usuario
      const success = await googleLogin(tokenResponse.access_token, role);
      if (success) {
        // El auth context redirigirá automáticamente si es exitoso
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.phone.length !== 10)
      return alert("Teléfono debe ser 10 dígitos");
    if (formData.password.length < 5)
      return alert("Contraseña mín 5 caracteres");

    const emailDomain = "@" + formData.email.split("@")[1];
    if (!ALLOWED_EMAILS.includes(emailDomain)) {
      return alert(
        "Dominio de correo no permitido. Use Gmail, Hotmail, Outlook o Yahoo.",
      );
    }

    if (!formData.ineImage) return alert("Debes subir tu INE");

    const baseUser: Omit<User, "id"> = {
      role: role,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      email: formData.email,
      password: formData.password,
      ineImage: formData.ineImage,
      approved: false,
    };

    let success = false;
    if (role === UserRole.STORE) {
      if (!formData.storeColonyId) return alert("Selecciona colonia");
      success = await register({
        ...baseUser,
        storeName: formData.storeName,
        storeAddress: {
          street: formData.storeStreet,
          number: formData.storeNumber,
          colonyId: formData.storeColonyId,
        },
        subscription: SubscriptionType.STANDARD, // Defaults to standard, Master changes it
        subscriptionPriority: 0,
        isOpen: false,
      } as any);
    } else {
      success = await register(baseUser as any);
    }

    if (success) {
      alert(
        "Solicitud enviada. Espera a que tu cuenta sea aprobada (Esto puede demorar algunos minutos).",
      );
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-secondary p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl p-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={onBack} className="mr-2">
            <Icons.ChevronDown className="rotate-90" size={24} />
          </Button>
          <h2 className="text-2xl font-bold text-iosText">
            Solicitud de Registro
          </h2>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
          {[UserRole.CLIENT, UserRole.STORE, UserRole.DELIVERY].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${role === r ? "bg-white shadow-sm text-primary" : "text-gray-400"}`}
            >
              {r === UserRole.CLIENT
                ? "Cliente"
                : r === UserRole.STORE
                  ? "Tienda"
                  : "Repartidor"}
            </button>
          ))}
        </div>

        {/* Solo mostramos Social Login si el rol es Cliente (Simplificación de flujo) */}
        {role === UserRole.CLIENT && (
          <div className="mb-8">
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleGoogleRegister()}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 py-3 rounded-2xl font-medium transition-all active:scale-[0.98] hover:bg-gray-50 hover:border-gray-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Registrarse con Google
              </button>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="border-t border-gray-200 w-full"></div>
              <span className="bg-white px-3 text-xs text-gray-400 font-medium absolute">
                O completa el formulario
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="firstName"
              label="Nombre(s)"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
            <Input
              name="lastName"
              label="Apellido(s)"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="flex gap-2 items-end">
            <div className="mb-4 px-3 py-3 bg-gray-200 rounded-2xl text-gray-600 font-bold">
              +52
            </div>
            <Input
              name="phone"
              label="Teléfono (10 dígitos)"
              value={formData.phone}
              onChange={handleChange}
              required
              type="tel"
              maxLength={10}
            />
          </div>

          <Input
            name="email"
            label="Correo Electrónico"
            value={formData.email}
            onChange={handleChange}
            required
            type="email"
            placeholder="ejemplo@gmail.com"
          />
          <div className="relative">
            <Input
              name="password"
              label="Contraseña (Mín 5)"
              value={formData.password}
              onChange={handleChange}
              required
              type={showPassword ? "text" : "password"}
              minLength={5}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 top-6 flex items-center px-4 text-gray-400 hover:text-primary"
            >
              {showPassword ? (
                <Icons.EyeOff size={20} />
              ) : (
                <Icons.Eye size={20} />
              )}
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">
              Identificación vigente
              <br />
              <span className="text-gray-300 text-xs mt-8 z-10">
                {" "}
                (Credencial de elector/ Licencia de conducir/ Credencial
                escolar){" "}
              </span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {isUploading && (
              <p className="text-xs text-blue-500 mt-1">
                Subiendo documento...
              </p>
            )}
          </div>

          {role === UserRole.STORE && (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4 mt-4">
              <h3 className="font-bold text-gray-700">Datos del Negocio</h3>
              <Input
                name="storeName"
                label="Nombre del Negocio"
                value={formData.storeName}
                onChange={handleChange}
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    name="storeStreet"
                    label="Calle"
                    value={formData.storeStreet}
                    onChange={handleChange}
                    required
                  />
                </div>
                <Input
                  name="storeNumber"
                  label="Número"
                  value={formData.storeNumber}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">
                  Colonia
                </label>
                <select
                  name="storeColonyId"
                  value={formData.storeColonyId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-100 border-transparent focus:bg-white focus:border-primary text-iosText"
                  required
                >
                  <option value="">Selecciona una colonia</option>
                  {colonies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full mt-6" disabled={isUploading}>
            Enviar Solicitud
          </Button>
        </form>
      </Card>
    </div>
  );
};
