import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api } from "../api";

interface AuthContextType {
  currentUser: any | null;
  loadingAuth: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  googleLogin: (token: string, role?: string) => Promise<boolean>;
  register: (user: any) => Promise<boolean>;
  updateUser: (user: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Cargar sesión guardada al iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      try {
        const user = JSON.parse(storedUser);
        if (user && (user._id || user.id)) {
          setCurrentUser(user);
        }
      } catch (e) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
    setLoadingAuth(false);
  }, []);

  // Listener de actividad (Solo actualiza el timestamp, el checkeo se mueve a App.tsx/Main)
  useEffect(() => {
    if (!currentUser) return;
    let lastUpdate = Date.now();

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) {
        localStorage.setItem("lastActive", now.toString());
        lastUpdate = now;
      }
    };

    // Inicializar
    localStorage.setItem("lastActive", Date.now().toString());

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keypress", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [currentUser]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await api.post("/api/login", { email, password: pass });
      const { user, token } = res.data;
      const safeUser = { ...user, id: user._id || user.id };
      delete safeUser.password;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(safeUser));
      setCurrentUser(safeUser);
      return true;
    } catch (e) {
      return false;
    }
  };

  const googleLogin = async (accessToken: string, role?: string) => {
    try {
      const res = await api.post("/api/auth/google", {
        token: accessToken,
        role,
      });
      const { user, token } = res.data;
      const safeUser = { ...user, id: user._id || user.id };
      delete safeUser.password;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(safeUser));
      setCurrentUser(safeUser);
      return true;
    } catch (e: any) {
      console.error("Google Login Error:", e.response?.data || e.message);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("cart");
    localStorage.removeItem("lastActive");
    setCurrentUser(null);
    window.location.href = "/";
  };

  const register = async (data: any) => {
    try {
      await api.post("/api/register", data);
      return true;
    } catch (e) {
      return false;
    }
  };

  const updateUser = async (u: any) => {
    const { _id, role, ...rest } = u;
    try {
      const res = await api.put(`/api/users/${u._id || u.id}`, rest);
      if (
        currentUser &&
        (u.id === currentUser.id || u._id === currentUser.id)
      ) {
        const updatedUser = { ...res.data, id: res.data._id || res.data.id };
        setCurrentUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loadingAuth,
        login,
        logout,
        googleLogin,
        register,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
