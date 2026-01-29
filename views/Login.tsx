import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Button, Input, Card } from '../components/UI';
import { Register } from './Register';

export const Login = () => {
  const { login } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      setError('');
    } else {
      setError('Credenciales inválidas o cuenta no aprobada');
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
          <div className="w-20 h-20 bg-primary rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-red-500/30">
             <span className="text-white font-bold text-3xl">R</span>
          </div>
          <h1 className="text-3xl font-bold text-iosText mb-1">RedDelivery</h1>
          <p className="text-gray-400 text-sm">Ingresa a tu cuenta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={(e:any) => setEmail(e.target.value)} 
          />
          <Input 
            type="password" 
            placeholder="Contraseña" 
            value={password} 
            onChange={(e:any) => setPassword(e.target.value)} 
          />
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <Button type="submit" className="w-full">Iniciar Sesión</Button>
        </form>
        
        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-2">¿No tienes cuenta?</p>
          <Button variant="ghost" onClick={() => setIsRegistering(true)} className="w-full text-primary font-bold">
            Crear Solicitud de Registro
          </Button>
        </div>

        <div className="mt-6 bg-gray-50 p-4 rounded-2xl text-xs text-gray-600">
           <p className="font-bold text-center mb-3 text-gray-400 uppercase tracking-wider">Cuentas Demo</p>
           <div className="space-y-2">
             <div className="flex justify-between items-center border-b border-gray-200 pb-1">
               <span className="font-bold text-primary bg-red-100 px-2 py-0.5 rounded">Master</span>
               <span className="font-mono">admin@red.com</span>
             </div>
             <div className="flex justify-between items-center border-b border-gray-200 pb-1">
               <span className="font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Tienda</span>
               <span className="font-mono">pizza@gmail.com</span>
             </div>
             <div className="flex justify-between items-center border-b border-gray-200 pb-1">
               <span className="font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">Cliente</span>
               <span className="font-mono">carlos@gmail.com</span>
             </div>
             <div className="flex justify-between items-center border-b border-gray-200 pb-1">
               <span className="font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">Repartidor</span>
               <span className="font-mono">beto@gmail.com</span>
             </div>
             <div className="text-center pt-2">
               Contraseña para todos: <span className="font-bold text-iosText bg-gray-200 px-2 py-0.5 rounded">123</span>
             </div>
           </div>
        </div>
      </Card>
    </div>
  );
};