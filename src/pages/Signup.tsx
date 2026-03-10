import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { SignupForm } from "@/components/signup-form"
import api from "@/lib/api"

export default function Signup() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (email: string, username: string, password: string) => {
    setLoading(true)
    try {
      const response = await api.post("/auth/signup", { email, username, password })
      localStorage.setItem("token", response.data.token)
      toast.success("Account created successfully!")
      navigate("/dashboard")
    } catch (err: any) {
      const message = err.response?.data?.message || "Signup failed. Please try again."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }
  return (
      <div className="flex w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <SignupForm onSubmit={handleSignup} loading={loading} />
        </div>
      </div>
    )
}