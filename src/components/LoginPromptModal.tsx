import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, LogIn } from 'lucide-react';

interface LoginPromptModalProps {
  open: boolean;
  onClose: () => void;
}

export const LoginPromptModal = ({ open, onClose }: LoginPromptModalProps) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    onClose();
    navigate('/auth');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-xl">Want more trend packs?</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Log in to save your brand voice, use tone meters, and unlock Pro features.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button onClick={handleLogin} className="w-full gap-2">
            <LogIn className="w-4 h-4" />
            Log in to continue
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
