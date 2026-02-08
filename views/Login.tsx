import React, { useState } from "react";
import { useApp } from "../AppContext";
import { Button, Input, Card } from "../components/UI";
import { Register } from "./Register";

export const Login = () => {
  const { login } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    return <Register onBack={() => setIsRegistering(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-700" />

      {/* Logo fuera de la caja */}
      <div className="z-10 mb-8 flex flex-col items-center animate-fade-in-down">
        <img
          src="/logo.svg"
          alt="Logo"
          className="w-64 h-64 object-contain drop-shadow-xl"
        />
      </div>

      {/* Formulario */}
      <Card className="w-full max-w-md shadow-2xl z-10 bg-white/90 backdrop-blur-md border border-white/50">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Bienvenido</h2>
          <p className="text-gray-400 text-sm">
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

      <p className="text-center text-gray-400 text-xs mt-8 z-10">
        © 2024 ProntoApp. Todos los derechos reservados.
      </p>
    </div>
  );
};
