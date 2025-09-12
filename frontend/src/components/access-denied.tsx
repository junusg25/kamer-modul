import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, ArrowLeft, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from './layout/main-layout'

interface AccessDeniedProps {
  title?: string
  message?: string
  showGoBack?: boolean
}

export function AccessDenied({ 
  title = "Access Denied",
  message = "You don't have permission to access this page.",
  showGoBack = true
}: AccessDeniedProps) {
  const navigate = useNavigate()

  const handleGoBack = () => {
    window.history.back()
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-full">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <Shield className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-3xl font-bold text-destructive">
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground text-lg leading-relaxed">
              {message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {showGoBack && (
                <Button 
                  onClick={handleGoBack}
                  variant="outline"
                  className="flex-1 sm:flex-none"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              )}
              <Button 
                onClick={handleGoHome}
                className="flex-1 sm:flex-none"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
