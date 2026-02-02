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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      setError("");
    } else {
      setError("Credenciales inválidas o cuenta no aprobada");
    }
  };

  if (isRegistering) {
    return <Register onBack={() => setIsRegistering(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-secondary relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl"></div>

      <Card className="w-full max-w-md shadow-2xl z-10">
        <div className="text-center mb-8">
          <img
            src="/logo.svg"
            alt="Logo"
            className="w-20 h-20 mx-auto mb-4 object-contain"
          />
          <p className="text-gray-400 text-sm">Ingresa a tu cuenta</p>
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

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <Button type="submit" className="w-full">
            Iniciar Sesión
          </Button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-2">¿No tienes cuenta?</p>
          <Button
            variant="ghost"
            onClick={() => setIsRegistering(true)}
            className="w-full text-primary font-bold"
          >
            Crear Solicitud de Registro
          </Button>
        </div>
      </Card>
    </div>
  );
};
