import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { Button, Input, Card } from "../components/UI";
import { Register } from "./Register";
import { Icons } from "../constants";

export const Login = () => {
  const { colonies, fetchColonies } = useApp();
  const { login } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  if (isRegistering) {
    return (
      <Register onBack={() => setIsRegistering(false)} colonies={colonies} />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-primary relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl animate-pulse delay-700" />

      {/* Logo fuera de la caja */}
      <div className="z-10 mb-4 flex flex-col items-center animate-fade-in-down">
        <img
          src="/logowhite.svg"
          alt="Logo"
          className="w-40 h-40 object-contain drop-shadow-xl"
        />
      </div>

      {/* Formulario */}
      <Card className="w-full max-w-md shadow-2xl z-10 bg-white backdrop-blur-md border border-white/50">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
            <Icons.MapPin className="text-primary" />
            Canatlán
          </h2>
          <p className="text-gray-500 text-sm">
            Ingresa a tu cuenta para continuar
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
          />
          {error && (
            <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full shadow-lg shadow-primary/20"
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
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
