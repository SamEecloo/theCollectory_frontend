// reset-password-form.tsx
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { Link } from "react-router-dom"

type ResetPasswordFormProps = {
  onSubmit: (password: string) => void
  className?: string
  loading?: boolean
  error?: string
  invalidToken?: boolean
}

export function ResetPasswordForm({ className, onSubmit, loading, error, invalidToken }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [validationError, setValidationError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setValidationError("Passwords do not match")
      return
    }
    setValidationError("")
    onSubmit(password)
  }

  if (invalidToken) {
    return (
      <div className={cn("flex flex-col gap-6 w-full", className)}>
        <Card>
          <CardHeader>
            <CardTitle>Invalid or expired link</CardTitle>
            <CardDescription>
              This reset link has expired or already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/forgot-password" className="text-sm underline-offset-4 hover:underline">
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6 w-full", className)}>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Must be at least 8 characters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {(validationError || error) && (
                <p className="text-sm text-red-500">{validationError || error}</p>
              )}
              <Button variant="default" type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Reset password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}