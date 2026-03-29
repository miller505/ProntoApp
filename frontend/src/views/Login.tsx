import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { Button, Input, Card } from "../components/UI";
import { Register } from "./Register";
import { Icons } from "../constants";
import { useGoogleLogin } from "@react-oauth/google";

export const Login = () => {
  const { colonies, fetchColonies } = useApp();
  const { login, googleLogin } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if ((!colonies || colonies.length === 0) && fetchColonies) {
      fetchColonies();
    }
  }, [colonies, fetchColonies]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    if (success) {
      setError("");
    } else {
      setError("Credenciales inválidas o cuenta no aprobada");
    }
    setLoading(false);
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      const success = await googleLogin(tokenResponse.access_token);
      if (!success) setError("No se pudo iniciar sesión con Google.");
      setLoading(false);
    },
    onError: (errorResponse) => {
      console.error("Google Login Error:", errorResponse);
      setError("Error al conectar con Google");
    },
    flow: "implicit", // Obtenemos el access_token directamente
  });

  if (isRegistering) {
    return <Register onBack={() => setIsRegistering(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-primary relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl animate-pulse delay-700" />

      {/* Logo fuera de la caja */}
      <div className="z-10 mb-4 flex flex-col items-center animate-fade-in-down">
        <img
          src="/logowhite.svg?v=2"
          alt="Logo"
          className="w-40 h-40 object-contain drop-shadow-xl"
        />
      </div>

      {/* Formulario */}
      <Card className="w-full max-w-md shadow-2xl z-10 bg-white backdrop-blur-md border border-white/50 p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
            <Icons.MapPin className="text-primary" />
            Canatlán
          </h2>
          <p className="text-gray-500 text-sm">
            Ingresa a tu cuenta para continuar
          </p>
        </div>

        {/* Social Login Buttons */}
        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
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
            Continuar con Google
          </button>
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-gray-200 w-full"></div>
          <span className="bg-white px-3 text-xs text-gray-400 font-medium absolute">
            O ingresa con tu email
          </span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-primary"
            >
              {showPassword ? (
                <Icons.EyeOff size={20} />
              ) : (
                <Icons.Eye size={20} />
              )}
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full shadow-lg shadow-primary/20 py-3.5"
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-2">¿No tienes cuenta?</p>
          <Button
            variant="ghost"
            onClick={() => setIsRegistering(true)}
            className="w-full text-primary font-bold hover:bg-primary/5"
          >
            Crear Solicitud de Registro
          </Button>
        </div>
      </Card>

      <p className="text-center text-white/70 text-xs mt-8 z-10">
        © 2026 ProntoApp. Todos los derechos reservados.
      </p>
    </div>
  );
};
