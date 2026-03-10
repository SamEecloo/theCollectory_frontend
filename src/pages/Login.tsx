import { useLocation, useNavigate } from "react-router-dom"
import { LoginForm } from "@/components/login-form"
import api from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

export default function Login() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const { setToken } = useAuth()
  const activated = new URLSearchParams(search).get('activated')
  const handleLogin = async (email: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { email, password })
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.username);
      setToken(res.data.token)
      navigate("/dashboard")
    } catch (err: any) {
      const errorCode = err?.response?.data?.error
      if (errorCode === 'not_activated') {
        // pass down to LoginForm
        throw new Error('not_activated')
      }
      throw err
    }
  }

  return (
    <div className="flex w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {activated && (
          <p className="mb-4 text-center text-sm text-green-600">
            Account activated! You can now log in.
          </p>
        )}
        <LoginForm onSubmit={handleLogin} />
      </div>
    </div>
  )
}
