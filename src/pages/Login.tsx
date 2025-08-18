import { useNavigate } from "react-router-dom"
import { LoginForm } from "@/components/login-form"
import api from "@/lib/api"
import { useAuth } from "@/context/useAuth"

export default function Login() {
  const navigate = useNavigate()
  const { setToken } = useAuth()

  const handleLogin = async (username: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { username, password })
      localStorage.setItem("token", res.data.token)
      setToken(res.data.token)
      navigate("/dashboard")
    } catch (err) {
      alert("Login failed: " + err)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm onSubmit={handleLogin} />
      </div>
    </div>
  )
}
