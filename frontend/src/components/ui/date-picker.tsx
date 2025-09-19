"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { formatDateForInput } from "../../lib/dateTime"

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
}

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  weekStartsOn?: 0 | 1
  className?: string
}

// Simple Calendar component
export function Calendar({ selected, onSelect, weekStartsOn = 1, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const startDay = new Date(currentMonth)
  startDay.setDate(1 - ((currentMonth.getDay() + 7 - weekStartsOn) % 7))

  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDay)
    date.setDate(startDay.getDate() + i)
    days.push({
      date,
      isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
    })
  }

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
  if (weekStartsOn === 0) dayNames.unshift(dayNames.pop()!)

  return (
    <div className={cn("p-2", className)}>
      <div className="flex justify-between mb-2">
        <button onClick={handlePrevMonth} className="px-2">&lt;</button>
        <span className="font-medium">{format(currentMonth, "MMMM yyyy")}</span>
        <button onClick={handleNextMonth} className="px-2">&gt;</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium mb-1">
        {dayNames.map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
  {days.map(({ date, isCurrentMonth }) => {
    const isSelected = selected && date.toDateString() === selected.toDateString()
    return (
      <button
        key={date.toISOString()}
        onClick={() => onSelect?.(date)}
        disabled={!isCurrentMonth}
        className={cn(
          "h-10 w-10 flex items-center justify-center rounded hover:bg-gray-700 transition-colors",
          isSelected ? "bg-blue-500 text-white" : "",
          isCurrentMonth ? "text-white" : "text-gray-400"
        )}
      >
        {date.getDate()}
      </button>
    )
  })}
</div>

    </div>
  )
}

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className
}: DatePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => {
    if (!value) return undefined
    const parsed = parse(value, "dd.MM.yyyy", new Date())
    return isNaN(parsed.getTime()) ? undefined : parsed
  })

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (!value) {
      setSelectedDate(undefined)
    } else {
      const parsed = parse(value, "dd.MM.yyyy", new Date())
      setSelectedDate(isNaN(parsed.getTime()) ? undefined : parsed)
    }
  }, [value])

  const handleSelect = (date: Date) => {
    setSelectedDate(date)
    onChange?.(format(date, "dd.MM.yyyy"))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!selectedDate}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "dd.MM.yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Calendar
          selected={selectedDate}
          onSelect={handleSelect}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  )
}

// Hidden input component for form submission
interface DatePickerInputProps extends DatePickerProps {
  name?: string
  required?: boolean
}

export function DatePickerInput({
  value,
  onChange,
  name,
  required = false,
  ...props
}: DatePickerInputProps) {
  return (
    <div className="relative">
      <DatePicker
        value={value}
        onChange={onChange}
        {...props}
      />
      <input
        type="hidden"
        name={name}
        value={value ? formatDateForInput(value) : ''}
        required={required}
      />
    </div>
  )
}
