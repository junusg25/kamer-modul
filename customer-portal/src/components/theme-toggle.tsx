import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/theme-context';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
      <span className="text-sm hidden sm:inline">
        {theme === 'light' ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
