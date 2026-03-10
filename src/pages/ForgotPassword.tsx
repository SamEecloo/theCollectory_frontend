import { useState } from "react"
import { ForgotPasswordForm } from "@/components/forgot-password-form"
import api from "@/lib/api"

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (email: string) => {
    setLoading(true)
    try {
      await api.post("/auth/forgot-password", { email })
    } catch (err) {
      // Silently ignore — always show success to avoid email enumeration
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return <ForgotPasswordForm onSubmit={handleSubmit} loading={loading} submitted={submitted} />
}