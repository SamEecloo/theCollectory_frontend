import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ResetPasswordForm } from "@/components/reset-password-form"
import api from "@/lib/api"

export default function ResetPassword() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const token = new URLSearchParams(search).get("token")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (password: string) => {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      await api.post("/auth/reset-password", { token, password })
      navigate("/login", { state: { message: "Password reset successful. You can now log in." } })
    } catch (err: any) {
      setError(err?.response?.data?.error || "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return <ResetPasswordForm
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          invalidToken={!token}
        />
}