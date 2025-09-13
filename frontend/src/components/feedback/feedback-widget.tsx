import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { useAuth } from '../../contexts/auth-context'
import { useFeedback } from '../../contexts/feedback-context'
import { MessageSquare, X, Send, Bug, Lightbulb, ThumbsDown, AlertTriangle } from 'lucide-react'

interface FeedbackWidgetProps {
  onClose?: () => void
}

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'complaint' | 'other'
type Priority = 'low' | 'medium' | 'high' | 'urgent'

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'bg-red-100 text-red-800' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'bg-blue-100 text-blue-800' },
  { value: 'improvement', label: 'Improvement', icon: ThumbsDown, color: 'bg-green-100 text-green-800' },
  { value: 'complaint', label: 'Complaint', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'other', label: 'Other', icon: MessageSquare, color: 'bg-gray-100 text-gray-800' }
]

export function FeedbackWidget({ onClose }: FeedbackWidgetProps) {
  const { user } = useAuth()
  const { submitFeedback } = useFeedback()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [type, setType] = useState<FeedbackType>('bug')
  const [priority, setPriority] = useState<Priority>('medium')
  const [pageUrl, setPageUrl] = useState(window.location.pathname)
  
  // Update page URL when location changes
  React.useEffect(() => {
    const updatePageUrl = () => setPageUrl(window.location.pathname)
    updatePageUrl()
    
    // Listen for route changes
    window.addEventListener('popstate', updatePageUrl)
    return () => window.removeEventListener('popstate', updatePageUrl)
  }, [])

  const handleSubmit = async () => {
    if (!feedback.trim()) return

    setIsSubmitting(true)
    try {
      await submitFeedback({
        message: feedback.trim(),
        type,
        priority,
        page_url: window.location.pathname, // Use current page URL at submission time
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      })

      // Reset form
      setFeedback('')
      setType('bug')
      setPriority('medium')
      
      // Show success message (you can add a toast notification here)
      alert('Feedback submitted successfully! Thank you for helping improve the app.')
      
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedType = feedbackTypes.find(t => t.value === type)

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700"
            size="icon"
          >
            <MessageSquare className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}

      {/* Feedback Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96">
          <Card className="shadow-2xl border-2 border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  User Feedback
                  {selectedType && (
                    <Badge className={`${selectedType.color} text-xs`}>
                      {selectedType.label}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsOpen(false)
                    onClose?.()
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Help us improve the app! Report bugs, suggest features, or share your thoughts.
              </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Feedback Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Type of Feedback</label>
                <div className="grid grid-cols-2 gap-2">
                  {feedbackTypes.map((feedbackType) => {
                    const Icon = feedbackType.icon
                    return (
                      <Button
                        key={feedbackType.value}
                        variant={type === feedbackType.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setType(feedbackType.value as FeedbackType)}
                        className="justify-start gap-2 h-10"
                      >
                        <Icon className="h-4 w-4" />
                        {feedbackType.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor issue</SelectItem>
                    <SelectItem value="medium">Medium - Standard priority</SelectItem>
                    <SelectItem value="high">High - Important issue</SelectItem>
                    <SelectItem value="urgent">Urgent - Critical issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Feedback Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Message</label>
                <Textarea
                  placeholder="Describe the issue, suggestion, or feedback..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[100px] resize-none"
                  maxLength={1000}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {feedback.length}/1000 characters
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!feedback.trim() || isSubmitting}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>

              {/* User Info */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>From: {user?.name || 'Anonymous'}</p>
                <p>Page: {pageUrl}</p>
                <p>Time: {new Date().toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
